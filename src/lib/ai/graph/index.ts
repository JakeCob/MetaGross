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
import { HumanMessage } from "@langchain/core/messages";
import type { WriteActionProposal } from "@/lib/types/agent";
import type { Command } from "@langchain/langgraph";

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
function buildGraph() {
  const checkpointer = createCheckpointSaver();

  const graph = new StateGraph(AgentState)
    .addNode("load_context", loadContextNode)
    .addNode("retrieve_memory", retrieveMemoryNode)
    .addNode("agent", agentNode)
    .addNode("tool_executor", toolExecutorNode)
    .addNode("review_write", reviewWriteNode)
    .addNode("verify_response", verifyResponseNode)
    .addNode("validate", validateResponseNode)
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
    // After validation: END
    .addEdge("validate", END);

  return graph.compile({ checkpointer });
}

// Lazy singleton
let _compiledGraph: ReturnType<typeof buildGraph> | null = null;

function getGraph() {
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
}

/**
 * Invoke the agent graph with a new user message.
 * Returns an async iterable of streamed events.
 */
export async function invokeAgent(message: string, options: InvokeAgentOptions) {
  const graph = getGraph();

  const input = {
    messages: [new HumanMessage(message)],
    threadId: options.threadId,
    contextType: options.contextType,
    contextId: options.contextId,
    persona: options.persona,
    loadedContext: null,
    memoryHits: [],
    pendingAction: null,
    providerOverride: options.provider ?? null,
    modelOverride: options.modelName ?? null,
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
