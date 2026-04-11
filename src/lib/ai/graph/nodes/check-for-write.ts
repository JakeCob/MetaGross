import type { AgentStateType } from "../state";
import type { AIMessage } from "@langchain/core/messages";

/**
 * Conditional edge: determine the next step after the agent responds or tools execute.
 *
 * Routes:
 * - "review_write" — if a write action proposal is pending
 * - "tool_executor" — if the last AI message has tool calls to process
 * - "__end__" — otherwise (final response ready)
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

  return "__end__";
}
