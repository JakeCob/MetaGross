import { NextResponse } from "next/server";
import { getThread } from "@/lib/db/queries/agent-threads";
import { getThreadState, getThreadInterrupts } from "@/lib/ai/graph";
import type { BaseMessage } from "@langchain/core/messages";

interface RouteParams {
  params: Promise<{ threadId: string }>;
}

/**
 * GET /api/agent/[threadId]
 *
 * Load thread metadata and message history from the checkpoint.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { threadId } = await params;

  const thread = getThread(threadId);
  if (!thread) {
    return NextResponse.json(
      { error: `Thread not found: ${threadId}` },
      { status: 404 },
    );
  }

  try {
    const state = await getThreadState(threadId);
    const interrupts = await getThreadInterrupts(threadId);

    // Extract messages from state
    const messages: { role: string; content: string; toolCalls?: unknown[] }[] = [];

    if (state && state.values && typeof state.values === "object" && "messages" in state.values) {
      const stateMessages = (state.values as { messages: BaseMessage[] }).messages ?? [];
      for (const msg of stateMessages) {
        const type = msg._getType();
        if (type === "human") {
          messages.push({ role: "user", content: String(msg.content) });
        } else if (type === "ai") {
          const aiMsg = msg as { content: unknown; tool_calls?: unknown[] };
          messages.push({
            role: "assistant",
            content: String(aiMsg.content ?? ""),
            toolCalls: aiMsg.tool_calls,
          });
        } else if (type === "tool") {
          messages.push({ role: "tool", content: String(msg.content) });
        }
      }
    }

    return NextResponse.json({
      thread,
      messages,
      interrupted: interrupts !== null,
      pendingApproval: interrupts?.[0] ?? null,
    });
  } catch (err) {
    // If checkpoint doesn't exist yet (brand new thread), return empty messages
    return NextResponse.json({
      thread,
      messages: [],
      interrupted: false,
      pendingApproval: null,
    });
  }
}
