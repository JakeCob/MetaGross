import { ToolNode } from "@langchain/langgraph/prebuilt";
import { allTools, writeTools } from "@/lib/ai/tools";
import type { AgentStateType, AgentStateUpdate } from "../state";
import type { WriteActionProposal } from "@/lib/types/agent";
import type { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { logAgentEvent } from "@/lib/ai/logger";
import { detectProvider, getModelName } from "../model";

// Write tool names for detecting proposals
const WRITE_TOOL_NAMES: Set<string> = new Set(writeTools.map((t) => t.name));

/**
 * Shared ToolNode instance that can execute all registered tools.
 */
const toolNode = new ToolNode(allTools);

/**
 * Graph node: execute tool calls from the agent's last message.
 *
 * Logs every tool call + result to the agent log file.
 */
export async function toolExecutorNode(
  state: AgentStateType,
): Promise<Partial<AgentStateUpdate>> {
  const provider = detectProvider();
  const model = getModelName(provider);
  const sessionId = state.threadId || "unknown";

  // Log tool calls before execution
  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg && lastMsg._getType() === "ai") {
    const aiMsg = lastMsg as AIMessage;
    if (aiMsg.tool_calls) {
      for (const tc of aiMsg.tool_calls) {
        logAgentEvent({
          sessionId,
          agent: "metagross-main",
          node: "tool_executor",
          model,
          provider,
          action: "tool_call",
          toolName: tc.name,
          toolArgs: tc.args,
        });
      }
    }
  }

  // Execute tools
  const startTime = Date.now();
  const result = await toolNode.invoke({ messages: state.messages });
  const durationMs = Date.now() - startTime;
  const resultMessages: BaseMessage[] = result.messages;

  // Log tool results + check for write proposals
  let pendingAction: WriteActionProposal | null = null;

  for (const msg of resultMessages) {
    if (msg._getType() === "tool") {
      const toolMsg = msg as ToolMessage;
      const toolName = toolMsg.name;
      const content = typeof toolMsg.content === "string"
        ? toolMsg.content
        : JSON.stringify(toolMsg.content);

      logAgentEvent({
        sessionId,
        agent: "metagross-main",
        node: "tool_executor",
        model,
        provider,
        action: "tool_result",
        toolName: toolName ?? "unknown",
        toolResult: content.slice(0, 500),
        durationMs,
      });

      if (toolName && WRITE_TOOL_NAMES.has(toolName)) {
        try {
          pendingAction = JSON.parse(content) as WriteActionProposal;
        } catch {
          // If parsing fails, skip
        }
      }
    }
  }

  return {
    messages: resultMessages,
    pendingAction,
  };
}
