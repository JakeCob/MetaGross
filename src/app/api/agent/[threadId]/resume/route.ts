import { NextResponse } from "next/server";
import { resumePayloadSchema } from "@/lib/validation/agent";
import { getThread } from "@/lib/db/queries/agent-threads";
import { createFeedback } from "@/lib/db/queries/agent-feedback";
import { resumeAgent } from "@/lib/ai/graph";
import type { BaseMessage } from "@langchain/core/messages";
import type { AIMessage } from "@langchain/core/messages";
import type { WriteActionProposal } from "@/lib/types/agent";

interface RouteParams {
  params: Promise<{ threadId: string }>;
}

/**
 * POST /api/agent/[threadId]/resume
 *
 * Resume an interrupted agent graph with the user's decision.
 * Streams the continued response.
 *
 * Body: { action: 'approve'|'reject'|'edit', editedPayload?: unknown }
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { threadId } = await params;

  try {
    const body = await request.json();
    const parsed = resumePayloadSchema.safeParse({ ...body, threadId });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const thread = getThread(threadId);
    if (!thread) {
      return NextResponse.json(
        { error: `Thread not found: ${threadId}` },
        { status: 404 },
      );
    }

    const { action, editedPayload } = parsed.data;

    // Store the feedback event
    createFeedback({
      threadId,
      eventType: action,
      targetType: "write_action",
      payloadJson: editedPayload ?? null,
    });

    // Stream the resumed response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function send(event: string, data: unknown) {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        }

        try {
          const eventStream = await resumeAgent(threadId, action, editedPayload);

          for await (const state of eventStream) {
            const messages: BaseMessage[] = state.messages ?? [];
            const lastMsg = messages[messages.length - 1];

            if (!lastMsg) continue;

            if (lastMsg._getType() === "ai") {
              const aiMsg = lastMsg as AIMessage;

              if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
                send("tool_calls", {
                  calls: aiMsg.tool_calls.map((tc) => ({
                    name: tc.name,
                    args: tc.args,
                    id: tc.id,
                  })),
                });
              }

              if (aiMsg.content && typeof aiMsg.content === "string" && aiMsg.content.length > 0) {
                send("text", { content: aiMsg.content });
              }
            }

            if (state.pendingAction) {
              send("pending_approval", state.pendingAction as WriteActionProposal);
            }
          }

          send("done", { threadId });
        } catch (err: unknown) {
          const error = err as { name?: string; interrupts?: unknown[] };
          if (error.name === "GraphInterrupt" || (error.interrupts && Array.isArray(error.interrupts))) {
            const interrupts = error.interrupts as { value: unknown }[];
            if (interrupts && interrupts.length > 0) {
              send("pending_approval", interrupts[0].value as WriteActionProposal);
            }
            send("interrupted", { threadId });
          } else {
            send("error", { message: (err as Error).message ?? "Unknown error" });
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
