import type { AgentStateType } from "../state";
import type { AIMessage } from "@langchain/core/messages";

/**
 * Conditional edge: determine the next step after the agent responds or tools execute.
 *
 * Routes:
 * - "review_write"    — if a write action proposal is pending
 * - "tool_executor"   — if the last AI message has tool calls to process
 * - "verify_response" — otherwise (agent produced a final answer; run
 *                       hallucination checks before streaming to user)
 */
export function checkForWrite(state: AgentStateType): string {
  // If we have a pending write action, route to the approval step
  if (state.pendingAction) {
    return "review_write";
  }

  // Check if the last message is an AI message with tool calls
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

  // Final answer — run the response verifier before validation.
  return "verify_response";
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
