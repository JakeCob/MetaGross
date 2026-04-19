import { NextResponse } from "next/server";
import { chatMessageSchema, threadCreateSchema } from "@/lib/validation/agent";
import { createThread, getThread } from "@/lib/db/queries/agent-threads";
import { invokeAgent } from "@/lib/ai/graph";
import { detectProvider, getModelName } from "@/lib/ai/graph/model";
import type { BaseMessage } from "@langchain/core/messages";
import type { AIMessage } from "@langchain/core/messages";
import type { WriteActionProposal } from "@/lib/types/agent";

/**
 * POST /api/agent
 *
 * Create a new thread or continue an existing one.
 * Streams the agent response back to the client.
 *
 * Body (new thread):
 *   { message: string, contextType: string, contextId?: string, persona?: string }
 *
 * Body (continue thread):
 *   { message: string, threadId: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    let threadId: string;
    let contextType: string;
    let contextId: string | null;
    let persona: string;

    if (body.threadId) {
      // Continue existing thread
      const parsed = chatMessageSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid input", details: parsed.error.issues },
          { status: 400 },
        );
      }

      const thread = getThread(parsed.data.threadId);
      if (!thread) {
        return NextResponse.json(
          { error: `Thread not found: ${parsed.data.threadId}` },
          { status: 404 },
        );
      }

      threadId = thread.id;
      contextType = thread.contextType ?? "general";
      contextId = thread.contextId ?? null;
      persona = thread.persona ?? "default";
    } else {
      // Create new thread
      const ctxParsed = threadCreateSchema.safeParse(body);
      if (!ctxParsed.success) {
        return NextResponse.json(
          { error: "Invalid input", details: ctxParsed.error.issues },
          { status: 400 },
        );
      }

      if (!body.message || typeof body.message !== "string" || body.message.trim() === "") {
        return NextResponse.json(
          { error: "message is required and cannot be empty" },
          { status: 400 },
        );
      }

      const provider = detectProvider();
      const model = getModelName(provider);

      const thread = createThread({
        title: ctxParsed.data.title ?? body.message.slice(0, 80),
        contextType: ctxParsed.data.contextType,
        contextId: ctxParsed.data.contextId ?? null,
        provider,
        model,
        persona: ctxParsed.data.persona ?? "default",
      });

      threadId = thread.id;
      contextType = ctxParsed.data.contextType;
      contextId = ctxParsed.data.contextId ?? null;
      persona = ctxParsed.data.persona ?? "default";
    }

    const message = body.message as string;

    // Stream the response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function send(event: string, data: unknown) {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        }

        try {
          send("thread", { threadId });

          const eventStream = await invokeAgent(message, {
            threadId,
            contextType,
            contextId,
            persona,
            provider: typeof body.provider === "string" ? body.provider : null,
            modelName: typeof body.modelName === "string" ? body.modelName : null,
          });

          // Buffer the final text — only send the LAST AI text message
          // (the validation node may replace earlier AI messages)
          let finalText = "";
          let toolCallsSent = 0;

          for await (const state of eventStream) {
            const messages: BaseMessage[] = state.messages ?? [];
            const lastMsg = messages[messages.length - 1];

            if (!lastMsg) continue;

            if (lastMsg._getType() === "ai") {
              const aiMsg = lastMsg as AIMessage;

              // Stream tool calls immediately (these are progress indicators)
              if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
                const newCalls = aiMsg.tool_calls.slice(toolCallsSent);
                if (newCalls.length > 0) {
                  // Send human-readable status for each tool call
                  for (const tc of newCalls) {
                    const statusMsg =
                      tc.name === "get_pokemon_competitive_sets" ? `Looking up ${(tc.args as Record<string,string>).species} competitive data...` :
                      tc.name === "optimize_ev_spread" ? `Running EV debate for ${(tc.args as Record<string,string>).species} (Wolfe + Cybertron)...` :
                      tc.name === "get_meta_data" ? "Checking Champions meta data..." :
                      tc.name === "calculate_damage" ? "Running damage calc..." :
                      tc.name === "check_speed" ? "Comparing speed tiers..." :
                      tc.name === "search_web" ? "Searching web..." :
                      tc.name === "fetch_reference" ? `Checking ${(tc.args as Record<string,string>).reference?.replace(/_/g, ' ') ?? 'reference'}...` :
                      `Using ${tc.name}...`;
                    send("status", { message: statusMsg });
                  }

                  send("tool_calls", {
                    calls: newCalls.map((tc) => ({
                      name: tc.name,
                      args: tc.args,
                      id: tc.id,
                    })),
                  });
                  toolCallsSent = aiMsg.tool_calls.length;
                }
              }

              // Buffer text content — DON'T send yet (validation may replace it)
              const content = aiMsg.content;
              if (content) {
                let textContent = "";
                if (typeof content === "string") {
                  textContent = content;
                } else if (Array.isArray(content)) {
                  textContent = content
                    .filter((block): block is { type: "text"; text: string } =>
                      typeof block === "object" && block !== null && "type" in block && block.type === "text" && "text" in block
                    )
                    .map((block) => block.text)
                    .join("");
                }
                if (textContent.length > 0) {
                  finalText = textContent; // overwrite — always keep the latest
                }
              }
            }

            // Stream tool results immediately (progress indicators)
            if (lastMsg._getType() === "tool") {
              const toolContent = typeof lastMsg.content === "string"
                ? lastMsg.content
                : JSON.stringify(lastMsg.content);
              send("tool_result", {
                name: (lastMsg as unknown as { name?: string }).name ?? "tool",
                result: toolContent.slice(0, 500),
              });
            }

            // Check for pending approval (interrupt)
            if (state.pendingAction) {
              send("pending_approval", state.pendingAction as WriteActionProposal);
            }
          }

          // Send the final (validated) text response
          if (finalText) {
            send("text", { content: finalText });
          }

          send("done", { threadId });
        } catch (err: unknown) {
          // Check if this is a GraphInterrupt (normal for approval flow)
          const error = err as { name?: string; message?: string; interrupts?: unknown[] };
          if (error.name === "GraphInterrupt" || (error.interrupts && Array.isArray(error.interrupts))) {
            // This is expected — the graph was interrupted for approval
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
