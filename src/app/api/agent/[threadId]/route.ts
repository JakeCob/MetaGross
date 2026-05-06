import { NextResponse } from "next/server";
import {
  getThread,
  deleteThread,
  updateThread,
} from "@/lib/db/queries/agent-threads";
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

  const thread = await getThread(threadId);
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

/**
 * PATCH /api/agent/[threadId]
 *
 * Rename a thread (and/or change its persona). Checkpointer state is
 * untouched — only the row in agent_threads changes.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { threadId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { title, persona } = body as { title?: string; persona?: string };
  const updated = await updateThread(threadId, {
    ...(typeof title === "string" ? { title } : {}),
    ...(typeof persona === "string" ? { persona } : {}),
  });
  if (!updated) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }
  return NextResponse.json({ thread: updated });
}

/**
 * DELETE /api/agent/[threadId]
 *
 * Remove the thread row. The LangGraph checkpoint stays on disk (cheap
 * to leave — it's a keyed blob) but becomes orphaned and will be
 * garbage-collected the next time we prune.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { threadId } = await params;
  const ok = await deleteThread(threadId);
  if (!ok) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
