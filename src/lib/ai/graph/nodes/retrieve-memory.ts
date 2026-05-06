import type { AgentStateType, AgentStateUpdate } from "../state";
import {
  getMemoriesByScope,
  searchRelevantMemories,
} from "@/lib/db/queries/agent-memories";
import { HumanMessage } from "@langchain/core/messages";
import { embed } from "@/lib/ai/embeddings";

/**
 * Retrieve memories for the current turn.
 *
 * Mix of strategies:
 *   1. Global + thread + context-scoped memories pulled by scope (cheap
 *      lookup, no embedding) — stays in for backward compatibility.
 *   2. Semantic search against the current user message — pulls
 *      top-K relevant memories from any scope using embeddings (or
 *      keyword scoring when OPENAI_API_KEY is missing).
 *
 * The agent node then renders these in the system prompt under
 * "## What I already know about you".
 */
export async function retrieveMemoryNode(
  state: AgentStateType,
): Promise<Partial<AgentStateUpdate>> {
  const { threadId, contextType, contextId } = state;
  const memoryHits: string[] = [];
  const seen = new Set<string>();
  const pushHit = (line: string) => {
    if (!line) return;
    const key = line.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    memoryHits.push(line);
  };

  // 1. Semantic search against the latest user message.
  const lastHuman = [...(state.messages ?? [])]
    .reverse()
    .find((m) => m._getType() === "human") as HumanMessage | undefined;
  const userText =
    lastHuman && typeof lastHuman.content === "string"
      ? lastHuman.content
      : "";

  if (userText.trim()) {
    const vec = await embed(userText).catch(() => null);
    // Global scope — user-level preferences/corrections apply everywhere.
    const globalHits = await searchRelevantMemories({
      query: userText,
      queryEmbedding: vec?.vector ?? null,
      scope: "global",
      limit: 5,
    });
    for (const { memory, score } of globalHits) {
      if (!memory.summary) continue;
      pushHit(
        `[memory/${memory.kind ?? "note"} ${score.toFixed(2)}] ${memory.summary}`,
      );
    }

    // Scope-specific (team/match) — pulled only when the thread has a
    // contextId. Slightly lower threshold because these are already
    // topic-filtered.
    if (
      (contextType === "team" || contextType === "match") &&
      contextId
    ) {
      const scopeKey = contextType === "team" ? "team" : "matchup";
      const scopedHits = await searchRelevantMemories({
        query: userText,
        queryEmbedding: vec?.vector ?? null,
        scope: scopeKey,
        limit: 3,
        minScore: vec ? 0.25 : 0.05,
      });
      for (const { memory, score } of scopedHits) {
        if (!memory.summary) continue;
        pushHit(
          `[memory/${scopeKey}/${memory.kind ?? "note"} ${score.toFixed(2)}] ${memory.summary}`,
        );
      }
    }
  }

  // 2. Backwards-compatible scope sweeps — always include the N most
  // recent entries so the agent sees them even if semantic search
  // missed.
  const global = (await getMemoriesByScope("global")).slice(0, 5);
  for (const m of global) {
    if (m.summary) pushHit(`[memory/global] ${m.summary}`);
  }

  if (threadId) {
    const threadMems = (await getMemoriesByScope("thread", threadId)).slice(0, 5);
    for (const m of threadMems) {
      if (m.summary) pushHit(`[memory/thread] ${m.summary}`);
    }
  }

  if (contextType === "team" && contextId) {
    const teamMems = (await getMemoriesByScope("team", contextId)).slice(0, 5);
    for (const m of teamMems) {
      if (m.summary) pushHit(`[memory/team] ${m.summary}`);
    }
  }

  if (contextType === "match" && contextId) {
    const matchMems = (await getMemoriesByScope("matchup", contextId)).slice(0, 5);
    for (const m of matchMems) {
      if (m.summary) pushHit(`[memory/matchup] ${m.summary}`);
    }
  }

  return { memoryHits };
}
