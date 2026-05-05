import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState } from "./state";
import { createCheckpointSaver } from "./checkpoint";
import { loadContextNode } from "./nodes/load-context";
import { retrieveMemoryNode } from "./nodes/retrieve-memory";
import { agentNode } from "./nodes/agent";
import { toolExecutorNode } from "./nodes/tool-executor";
import { checkForWrite, checkAfterVerify } from "./nodes/check-for-write";
import { reviewWriteNode } from "./nodes/review-write";
import { verifyResponseNode } from "./nodes/verify-response";
import { validateResponseNode } from "./nodes/validate-response";
import { extractMemoryNode } from "./nodes/extract-memory";
import { HumanMessage } from "@langchain/core/messages";
import type { WriteActionProposal } from "@/lib/types/agent";
import { shouldCacheCompiledGraph } from "./runtime";

/**
 * Build the compiled agent graph.
 *
 * Graph flow:
 *   START -> load_context -> retrieve_memory -> agent -> (conditional)
 *     - if tool_calls      -> tool_executor -> agent (loop)
 *     - if pendingAction   -> review_write -> agent (loop)
 *     - else (final answer) -> verify_response -> (conditional)
 *        - if violations     -> agent (one retry)
 *        - else              -> validate -> END
 */
function buildGraph(checkpointer = getCheckpointer()) {
  const graph = new StateGraph(AgentState)
    .addNode("load_context", loadContextNode)
    .addNode("retrieve_memory", retrieveMemoryNode)
    .addNode("agent", agentNode)
    .addNode("tool_executor", toolExecutorNode)
    .addNode("review_write", reviewWriteNode)
    .addNode("verify_response", verifyResponseNode)
    .addNode("validate", validateResponseNode)
    .addNode("extract_memory", extractMemoryNode)
    // Edges: START -> load_context -> retrieve_memory -> agent
    .addEdge(START, "load_context")
    .addEdge("load_context", "retrieve_memory")
    .addEdge("retrieve_memory", "agent")
    // After agent: conditional routing
    .addConditionalEdges("agent", checkForWrite, [
      "tool_executor",
      "review_write",
      "verify_response",
    ])
    // After tool execution: ALWAYS go back to agent
    .addEdge("tool_executor", "agent")
    // After write review: go back to agent
    .addEdge("review_write", "agent")
    // After response verification: retry agent on violations, else validate
    .addConditionalEdges("verify_response", checkAfterVerify, [
      "agent",
      "validate",
    ])
    // After validation: extract memories cross-thread, then END. The
    // extractor only writes to the DB — it never mutates state — so
    // it's safe to run as a terminal step.
    .addEdge("validate", "extract_memory")
    .addEdge("extract_memory", END);

  return graph.compile({ checkpointer });
}

let _checkpointer: ReturnType<typeof createCheckpointSaver> | null = null;

function getCheckpointer() {
  if (!_checkpointer) {
    _checkpointer = createCheckpointSaver();
  }
  return _checkpointer;
}

// Lazy singleton for production only. In dev/test we rebuild the graph so
// prompt/node changes take effect immediately instead of serving stale logic.
let _compiledGraph: ReturnType<typeof buildGraph> | null = null;

function getGraph() {
  if (!shouldCacheCompiledGraph()) {
    return buildGraph();
  }

  if (!_compiledGraph) {
    _compiledGraph = buildGraph();
  }
  return _compiledGraph;
}

export interface InvokeAgentOptions {
  threadId: string;
  contextType: string;
  contextId: string | null;
  persona: string;
  /** Optional user-selected provider override. */
  provider?: string | null;
  /** Optional user-selected model override (e.g. "gpt-4o", "claude-opus-4-7"). */
  modelName?: string | null;
  /** Snapshot of the user's live TeamBuilder draft. Surfaced in the
   *  system prompt so edit requests patch this team instead of
   *  generating a new one. */
  draftTeam?: unknown;
  /** Image attachments for this turn — wrapped into a multimodal
   *  HumanMessage so OpenAI / Anthropic vision models can see them. */
  attachments?: Array<{ name: string; mimeType: string; dataUrl: string }>;
}

/**
 * Build the seed `HumanMessage` for a turn. Pure function so unit
 * tests can verify the multimodal content shape without spinning up
 * the graph or hitting an LLM.
 *
 * - No attachments → a plain text HumanMessage (single string content).
 * - 1+ attachments → multimodal content array: one `text` block, then
 *   one `image_url` block per attachment. Both ChatOpenAI and
 *   ChatAnthropic translate `image_url` blocks to their native
 *   vision API on send.
 */
export function buildUserMessage(
  message: string,
  attachments?: Array<{ name?: string; mimeType?: string; dataUrl: string }>,
): HumanMessage {
  if (!attachments || attachments.length === 0) {
    return new HumanMessage(message);
  }
  return new HumanMessage({
    content: [
      { type: "text", text: message } as const,
      ...attachments.map(
        (a) =>
          ({
            type: "image_url",
            image_url: { url: a.dataUrl },
          }) as const,
      ),
    ],
  });
}

/**
 * Invoke the agent graph with a new user message.
 * Returns an async iterable of streamed events.
 */
export async function invokeAgent(message: string, options: InvokeAgentOptions) {
  const graph = getGraph();

  const userMessage = buildUserMessage(message, options.attachments);

  const input = {
    messages: [userMessage],
    threadId: options.threadId,
    contextType: options.contextType,
    contextId: options.contextId,
    persona: options.persona,
    loadedContext: null,
    memoryHits: [],
    pendingAction: null,
    providerOverride: options.provider ?? null,
    modelOverride: options.modelName ?? null,
    draftTeam:
      options.draftTeam &&
      typeof options.draftTeam === "object"
        ? (options.draftTeam as Record<string, unknown>)
        : null,
    // Reset per-turn extractor output so a previous turn's saved
    // memories don't leak into this turn's `memory_saved` SSE event.
    extractedMemoriesThisTurn: [],
  };

  const config = {
    configurable: { thread_id: options.threadId },
  };

  return graph.stream(input, { ...config, streamMode: "values" });
}

/**
 * Resume an interrupted graph (after human approval/rejection/edit).
 */
export async function resumeAgent(
  threadId: string,
  action: "approve" | "reject" | "edit",
  editedPayload?: unknown,
) {
  const graph = getGraph();

  const config = {
    configurable: { thread_id: threadId },
  };

  const resumeValue = { action, editedPayload };
  const { Command: CommandClass } = await import("@langchain/langgraph");

  return graph.stream(new CommandClass({ resume: resumeValue }), {
    ...config,
    streamMode: "values",
  });
}

/**
 * Get the current state snapshot for a thread (message history, etc.).
 */
export async function getThreadState(threadId: string) {
  const graph = getGraph();
  const config = { configurable: { thread_id: threadId } };
  return graph.getState(config);
}

/**
 * Check if a thread is currently interrupted (has a pending approval).
 */
export async function getThreadInterrupts(threadId: string) {
  const state = await getThreadState(threadId);
  if (state && state.tasks) {
    for (const task of state.tasks) {
      if ("interrupts" in task && Array.isArray(task.interrupts) && task.interrupts.length > 0) {
        return task.interrupts
          .filter((i) => i.value != null)
          .map((i) => i.value as WriteActionProposal);
      }
    }
  }
  return null;
}
