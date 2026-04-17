import { NextResponse } from "next/server";
import { getTurnAdvice, type CoachInput } from "@/lib/ai/battle-coach";

/**
 * POST /api/battle-coach
 *
 * Body: CoachInput (see lib/ai/battle-coach).
 * Streams SSE: "start" → "advice" → "done" | "error".
 *
 * Single LLM call on the server, so the stream is really just "start"
 * + "done" — but we use SSE for uniformity with the other AI routes
 * and to allow future multi-step coaching without a schema change.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CoachInput;

    if (!Array.isArray(body.activeP1) || !Array.isArray(body.activeP2)) {
      return NextResponse.json(
        { error: "activeP1 and activeP2 are required arrays" },
        { status: 400 },
      );
    }
    if (typeof body.turnNumber !== "number") {
      return NextResponse.json(
        { error: "turnNumber is required" },
        { status: 400 },
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        function send(event: string, data: unknown) {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        }

        try {
          send("start", { turn: body.turnNumber });
          const advice = await getTurnAdvice(body);
          send("advice", advice);
          send("done", { turn: body.turnNumber });
        } catch (err: unknown) {
          send("error", {
            message: (err as Error).message ?? "Unknown coach error",
          });
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
