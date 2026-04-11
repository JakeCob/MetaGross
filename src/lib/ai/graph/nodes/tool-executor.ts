import { ToolNode } from "@langchain/langgraph/prebuilt";
import { allTools, writeTools } from "@/lib/ai/tools";
import type { AgentStateType, AgentStateUpdate } from "../state";
import type { WriteActionProposal } from "@/lib/types/agent";
import type { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";

// Write tool names for detecting proposals
const WRITE_TOOL_NAMES: Set<string> = new Set(writeTools.map((t) => t.name));

/**
 * Shared ToolNode instance that can execute all registered tools.
 */
const toolNode = new ToolNode(allTools);

/**
 * Graph node: execute tool calls from the agent's last message.
 *
 * If a write tool was called, parse the result as a WriteActionProposal
 * and set state.pendingAction so the graph can route to the approval step.
 */
export async function toolExecutorNode(
  state: AgentStateType,
): Promise<Partial<AgentStateUpdate>> {
  // ToolNode expects { messages: BaseMessage[] }
  const result = await toolNode.invoke({ messages: state.messages });
  const resultMessages: BaseMessage[] = result.messages;

  // Check if any tool result is from a write tool
  let pendingAction: WriteActionProposal | null = null;

  for (const msg of resultMessages) {
    if (msg._getType() === "tool") {
      const toolMsg = msg as ToolMessage;
      const toolName = toolMsg.name;

      if (toolName && WRITE_TOOL_NAMES.has(toolName)) {
        // Parse the proposal from the tool result
        try {
          const content = typeof toolMsg.content === "string"
            ? toolMsg.content
            : JSON.stringify(toolMsg.content);
          pendingAction = JSON.parse(content) as WriteActionProposal;
        } catch {
          // If parsing fails, skip — the agent will see the raw result
        }
      }
    }
  }

  return {
    messages: resultMessages,
    pendingAction,
  };
}
