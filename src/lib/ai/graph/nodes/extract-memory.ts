import type { AgentStateType, AgentStateUpdate } from "../state";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { createModel, detectProvider } from "../model";
import {
  createMemory,
  findSimilarMemories,
  updateMemory,
  type MemoryKind,
} from "@/lib/db/queries/agent-memories";
import { embed } from "@/lib/ai/embeddings";
import { logAgentEvent } from "@/lib/ai/logger";
import { saveFeedback } from "@/lib/ai/knowledge";

/**
 * Post-turn extractor. Looks at the last user message + assistant
 * response and pulls out "memory-worthy" facts — preferences,
 * corrections, goals, team styles. Stores them in agent_memories so
 * future conversations can retrieve them cross-thread.
 *
 * Intentionally forgiving: this is best-effort enrichment, not a
 * blocking path. If the extractor LLM call fails or returns malformed
 * JSON we just log and move on.
 */
const EXTRACTOR_SYSTEM_PROMPT = `You scan the most recent user turn + assistant response and extract up to 3 durable "memories" — facts about the USER (not the Pokemon meta) that would help future conversations.

VALID memory kinds:
- preference   — user likes/dislikes ("I prefer offensive teams", "Don't suggest Trick Room")
- strategy    — user-specific playstyle insight ("User usually leads with Sneasler")
- correction  — user-supplied fact-correction to previously stored knowledge ("Actually Incineroar gets Throat Chop in Champions")
- team_style  — user's current team archetype / build focus ("Building a rain team around Archaludon")
- opponent_pattern — notes about a specific opponent/archetype the user keeps facing

DO NOT record:
- Meta facts (usage %, tournament results) — those belong in the tools, not memory.
- Ephemera like "user asked a question" or "assistant listed 5 teams".
- Duplicates of what's already in "<known memory>" below (the search results of already-stored memories).

Return JSON only, of the shape:
{ "memories": [ { "kind": "<kind>", "summary": "<<=120 chars, title-case-ish>", "content": "<1-2 sentences, include user quote when short>", "confidence": 0.0–1.0 } ] }

If nothing is memory-worthy, return { "memories": [] } — empty is correct.`;

interface ExtractedMemory {
  kind: MemoryKind;
  summary: string;
  content: string;
  confidence: number;
}

function parseExtractedMemories(raw: string): ExtractedMemory[] {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      memories?: unknown;
    };
    if (!parsed || !Array.isArray(parsed.memories)) return [];
    const out: ExtractedMemory[] = [];
    for (const m of parsed.memories) {
      if (!m || typeof m !== "object") continue;
      const entry = m as Record<string, unknown>;
      const kind = typeof entry.kind === "string" ? entry.kind : "";
      const summary = typeof entry.summary === "string" ? entry.summary : "";
      const content = typeof entry.content === "string" ? entry.content : "";
      const conf =
        typeof entry.confidence === "number" && !Number.isNaN(entry.confidence)
          ? Math.max(0, Math.min(1, entry.confidence))
          : 0.6;
      const kindOk: MemoryKind[] = [
        "preference",
        "strategy",
        "correction",
        "team_style",
        "opponent_pattern",
      ];
      if (!kindOk.includes(kind as MemoryKind)) continue;
      if (!summary.trim() || !content.trim()) continue;
      out.push({
        kind: kind as MemoryKind,
        summary: summary.trim().slice(0, 140),
        content: content.trim().slice(0, 600),
        confidence: conf,
      });
    }
    return out.slice(0, 3);
  } catch {
    return [];
  }
}

export async function extractMemoryNode(
  state: AgentStateType,
): Promise<Partial<AgentStateUpdate>> {
  const messages = state.messages ?? [];
  // Need at least one Human + one AI message to have a "turn" to extract from.
  const lastAi = [...messages].reverse().find((m) => m._getType() === "ai") as
    | AIMessage
    | undefined;
  const lastHuman = [...messages]
    .reverse()
    .find((m) => m._getType() === "human") as HumanMessage | undefined;
  if (!lastAi || !lastHuman) return {};

  // Skip extraction if the assistant is still mid-tool-call (no prose yet).
  if (lastAi.tool_calls && lastAi.tool_calls.length > 0) return {};

  const userText =
    typeof lastHuman.content === "string" ? lastHuman.content : "";
  const aiText = typeof lastAi.content === "string" ? lastAi.content : "";
  if (!userText.trim() || !aiText.trim()) return {};

  try {
    const provider = detectProvider();
    // Use a small fast model for extraction regardless of what the
    // main thread is running on. Haiku-class latency, pennies.
    const extractorProvider =
      process.env.ANTHROPIC_API_KEY ? "anthropic" : provider;
    const extractorModel =
      extractorProvider === "anthropic"
        ? "claude-haiku-4-5-20251001"
        : extractorProvider === "openai"
          ? "gpt-4o-mini"
          : undefined;

    const model = createModel(extractorProvider, extractorModel);

    // Build the extractor prompt. Include any already-matched memories
    // from this turn so the LLM can avoid duplicates without us having
    // to post-filter every extraction.
    const priorNotes = state.memoryHits?.length
      ? `\n\n<known memory>\n${state.memoryHits.slice(0, 10).join("\n")}\n</known memory>`
      : "";

    // Trim both ends of the window so the extractor's token footprint
    // stays predictable — long team-build responses were pushing peak
    // memory past the 4GB heap and contributing to OOM SIGTERMs.
    const trimmedUser = userText.slice(0, 1500);
    const trimmedAi = aiText.slice(0, 2500);
    const extractorInput = [
      { role: "system" as const, content: EXTRACTOR_SYSTEM_PROMPT + priorNotes },
      {
        role: "user" as const,
        content: `<user>\n${trimmedUser}\n</user>\n\n<assistant>\n${trimmedAi}\n</assistant>`,
      },
    ];

    const response = await model.invoke(extractorInput);
    const rawContent =
      typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
          ? response.content
              .filter(
                (b): b is { type: "text"; text: string } =>
                  typeof b === "object" &&
                  b !== null &&
                  "type" in b &&
                  (b as { type: string }).type === "text",
              )
              .map((b) => b.text)
              .join("")
          : "";

    const extracted = parseExtractedMemories(rawContent);
    if (extracted.length === 0) return {};

    // Persist each extracted memory, embedding + deduping against the
    // existing pool. We also collect the saved entries so the
    // surrounding SSE stream can emit a `memory_saved` event for the
    // UI toast.
    let inserted = 0;
    let merged = 0;
    const savedThisTurn: Array<{
      summary: string;
      kind: string;
      merged: boolean;
    }> = [];
    for (const m of extracted) {
      const vec = await embed(`${m.summary}\n${m.content}`);
      const dupes = await findSimilarMemories({
        content: m.content,
        embedding: vec?.vector ?? null,
        scope: "global",
        threshold: vec ? 0.9 : 0.6,
        limit: 1,
      });
      if (dupes.length > 0 && dupes[0].memory.id) {
        // Bump confidence on the existing row instead of inserting a
        // second copy. Raise toward the newly asserted confidence.
        const prev = dupes[0].memory.confidence ?? 0.5;
        updateMemory(dupes[0].memory.id, {
          confidence: Math.max(prev, m.confidence),
          // Refresh content if the new version is longer/more
          // specific — helps when we later asked a clarifying
          // question that expanded the memory.
          content:
            (m.content?.length ?? 0) > (dupes[0].memory.content?.length ?? 0)
              ? m.content
              : dupes[0].memory.content ?? m.content,
        });
        merged += 1;
        savedThisTurn.push({
          summary: m.summary,
          kind: m.kind,
          merged: true,
        });
        continue;
      }
      createMemory({
        scope: "global",
        kind: m.kind,
        summary: m.summary,
        content: m.content,
        confidence: m.confidence,
        sourceThreadId: state.threadId ?? null,
        embedding: vec?.vector ?? null,
        embeddingModel: vec?.model ?? null,
      });
      // Mirror corrections/preferences into docs/agent-knowledge/feedback-log.jsonl
      // so the loadKnowledgeContext() RAG path (which reads .md + the
      // jsonl file) picks them up too. Without this the extract-memory
      // writes only surface via retrieveMemoryNode's DB query — two
      // disjoint pipes for "what the agent knows about the user".
      if (m.kind === "correction" || m.kind === "preference") {
        try {
          saveFeedback({
            type: m.kind === "correction" ? "correction" : "preference",
            topic: m.summary,
            content: m.content,
            source: `extract_memory thread=${state.threadId ?? "unknown"}`,
          });
        } catch {
          // Non-fatal — DB write succeeded, log file is best-effort.
        }
      }
      inserted += 1;
      savedThisTurn.push({
        summary: m.summary,
        kind: m.kind,
        merged: false,
      });
    }

    logAgentEvent({
      sessionId: state.threadId || "unknown",
      agent: "metagross-main",
      node: "extract_memory",
      model: extractorModel ?? "unknown",
      provider: extractorProvider,
      action: "memory_extraction",
      metadata: { inserted, merged, considered: extracted.length },
    });

    if (savedThisTurn.length > 0) {
      // Surface to the SSE stream via state. The /api/agent route
      // observes this field on each yielded snapshot and emits a
      // `memory_saved` event for the UI to render a toast.
      return { extractedMemoriesThisTurn: savedThisTurn };
    }
  } catch (err) {
    console.error("[extract-memory] failed:", (err as Error).message);
  }
  // Extractor never mutates state — it only writes to the DB.
  return {};
}
