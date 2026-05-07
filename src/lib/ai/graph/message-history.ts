import type {
  AIMessage,
  BaseMessage,
  ToolMessage,
} from "@langchain/core/messages";

function getToolCallIds(message: AIMessage): string[] {
  return (message.tool_calls ?? [])
    .map((call) => call.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

function isCompleteToolCallBlock(
  expectedIds: string[],
  toolMessages: BaseMessage[],
): boolean {
  if (toolMessages.length !== expectedIds.length) return false;

  const expected = new Set(expectedIds);
  const seen = new Set<string>();

  for (const message of toolMessages) {
    const toolCallId = (message as ToolMessage).tool_call_id;
    if (!expected.has(toolCallId) || seen.has(toolCallId)) {
      return false;
    }
    seen.add(toolCallId);
  }

  return seen.size === expected.size;
}

/**
 * OpenAI rejects a history where an assistant tool-call message is not
 * immediately followed by exactly one tool result for every tool call.
 * A past bug could checkpoint that shape before approval interrupts.
 * Drop malformed tool-call blocks before invoking the model so the
 * user can continue the thread instead of staying stuck on 400s.
 */
export function sanitizeMessagesForModel(
  messages: BaseMessage[],
): BaseMessage[] {
  const sanitized: BaseMessage[] = [];

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];

    if (message._getType() === "ai") {
      const expectedIds = getToolCallIds(message as AIMessage);
      const rawToolCallCount = (message as AIMessage).tool_calls?.length ?? 0;

      if (rawToolCallCount > 0) {
        const toolMessages: BaseMessage[] = [];
        let nextIndex = i + 1;

        while (
          nextIndex < messages.length &&
          messages[nextIndex]._getType() === "tool"
        ) {
          toolMessages.push(messages[nextIndex]);
          nextIndex += 1;
        }

        if (
          expectedIds.length === rawToolCallCount &&
          isCompleteToolCallBlock(expectedIds, toolMessages)
        ) {
          sanitized.push(message, ...toolMessages);
        }

        i = nextIndex - 1;
        continue;
      }
    }

    if (message._getType() === "tool") {
      continue;
    }

    sanitized.push(message);
  }

  return sanitized;
}
