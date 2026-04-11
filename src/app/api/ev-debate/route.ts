import { NextResponse } from "next/server";
import { streamEVDebate } from "@/lib/ai/ev-debate";
import type { TeamPokemon } from "@/lib/types/pokemon";

/**
 * POST /api/ev-debate
 *
 * Runs the multi-agent EV debate for a single Pokemon.
 * Streams progress events (propose -> wolfe -> cybertron -> simulate -> finalize)
 * as SSE, then sends the final result.
 *
 * Body: { pokemon: TeamPokemon, team: TeamPokemon[], format?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const pokemon: TeamPokemon | undefined = body.pokemon;
    const team: TeamPokemon[] = body.team ?? [];
    const format: string = body.format ?? "champions-reg-m-a";

    if (!pokemon || !pokemon.species) {
      return NextResponse.json(
        { error: "pokemon.species is required" },
        { status: 400 },
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function send(event: string, data: unknown) {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        }

        try {
          send("start", { species: pokemon.species });

          const nodeLabels: Record<string, string> = {
            propose_spread: "propose",
            wolfe_review: "wolfe",
            cybertron_review: "cybertron",
            simulate: "simulate",
            finalize: "finalize",
          };

          let lastState: Record<string, unknown> = {};

          for await (const { node, state } of streamEVDebate(
            pokemon,
            team,
            format,
          )) {
            const label = nodeLabels[node] ?? node;
            lastState = { ...lastState, ...state };

            send("node", {
              node: label,
              data: {
                currentSpread: (state as Record<string, unknown>).currentSpread ?? undefined,
                currentNature: (state as Record<string, unknown>).currentNature ?? undefined,
                wolfeReview: (state as Record<string, unknown>).wolfeReview ?? undefined,
                cybertronReview: (state as Record<string, unknown>).cybertronReview ?? undefined,
                simulationResults: (state as Record<string, unknown>).simulationResults ?? undefined,
                finalSpread: (state as Record<string, unknown>).finalSpread ?? undefined,
                finalNature: (state as Record<string, unknown>).finalNature ?? undefined,
                finalReasoning: (state as Record<string, unknown>).finalReasoning ?? undefined,
                iterations: (state as Record<string, unknown>).iterations ?? undefined,
              },
            });
          }

          send("done", {
            spread: lastState.finalSpread ?? lastState.currentSpread,
            nature: lastState.finalNature ?? lastState.currentNature,
            reasoning: lastState.finalReasoning ?? "Complete.",
            wolfeComment: lastState.wolfeReview ?? "",
            cybertronComment: lastState.cybertronReview ?? "",
            benchmarks: lastState.simulationResults ?? [],
            iterations: lastState.iterations ?? 1,
          });
        } catch (err: unknown) {
          send("error", {
            message: (err as Error).message ?? "Unknown error",
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
