import { NextResponse } from "next/server";
import { streamEVDebate } from "@/lib/ai/ev-debate";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

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
    const format: string = body.format ?? ACTIVE_REGULATION_FORMAT_ID;

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
            simulate_initial: "simulate_initial",
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
            const s = state as Record<string, unknown>;

            send("node", {
              node: label,
              data: {
                currentSpread: s.currentSpread ?? undefined,
                currentNature: s.currentNature ?? undefined,
                currentMoves: s.currentMoves ?? undefined,
                currentAbility: s.currentAbility ?? undefined,
                currentItem: s.currentItem ?? undefined,
                wolfeReview: s.wolfeReview ?? undefined,
                cybertronReview: s.cybertronReview ?? undefined,
                initialSimulationResults: s.initialSimulationResults ?? undefined,
                simulationResults: s.simulationResults ?? undefined,
                finalSpread: s.finalSpread ?? undefined,
                finalNature: s.finalNature ?? undefined,
                finalMoves: s.finalMoves ?? undefined,
                finalAbility: s.finalAbility ?? undefined,
                finalItem: s.finalItem ?? undefined,
                finalReasoning: s.finalReasoning ?? undefined,
                iterations: s.iterations ?? undefined,
              },
            });
          }

          send("done", {
            spread: lastState.finalSpread ?? lastState.currentSpread,
            nature: lastState.finalNature ?? lastState.currentNature,
            moves: lastState.finalMoves ?? lastState.currentMoves ?? pokemon.moves,
            ability: lastState.finalAbility ?? lastState.currentAbility ?? pokemon.ability,
            item: lastState.finalItem ?? lastState.currentItem ?? pokemon.item,
            reasoning: lastState.finalReasoning ?? "Complete.",
            wolfeComment: lastState.wolfeReview ?? "",
            cybertronComment: lastState.cybertronReview ?? "",
            initialBenchmarks: lastState.initialSimulationResults ?? [],
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
