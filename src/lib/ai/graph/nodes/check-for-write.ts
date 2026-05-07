import type { AgentStateType } from "../state";
import type { AIMessage } from "@langchain/core/messages";

/**
 * Conditional edge: determine the next step after the agent responds or tools execute.
 *
 * Routes:
 * - "tool_executor"   — if the last AI message has tool calls to process
 * - "review_write"    — if a write action proposal is pending
 * - "verify_response" — otherwise (agent produced a final answer; run
 *                       hallucination checks before streaming to user)
 */
export function checkForWrite(state: AgentStateType): string {
  // Tool calls must be answered before any other message is added to
  // the conversation. This ordering is required by OpenAI/LangChain and
  // prevents INVALID_TOOL_RESULTS when a write proposal is also pending.
  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg && lastMsg._getType() === "ai") {
    const aiMsg = lastMsg as AIMessage;
    if (
      aiMsg.tool_calls &&
      Array.isArray(aiMsg.tool_calls) &&
      aiMsg.tool_calls.length > 0
    ) {
      return "tool_executor";
    }
  }

  // If we have a pending write action, route to the approval step.
  if (state.pendingAction) {
    return "review_write";
  }

  // Final answer — run the response verifier before validation.
  return "verify_response";
}

/**
 * Conditional edge after tool execution. Write tools return a pending
 * approval proposal as tool output, so route straight to the human
 * approval interrupt before invoking the model again.
 */
export function checkAfterToolExecution(state: AgentStateType): string {
  if (state.pendingAction) {
    return "review_write";
  }
  return "agent";
}

/**
 * Conditional edge after the response-verifier runs. If the verifier
 * appended a correction message (Human-role), loop back to the agent
 * for a revision pass. Otherwise proceed to final validation.
 */
export function checkAfterVerify(state: AgentStateType): string {
  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg && lastMsg._getType() === "human") {
    // Verifier injected a correction — agent needs another pass.
    return "agent";
  }
  return "validate";
}
