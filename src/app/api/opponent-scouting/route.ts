import { NextResponse } from "next/server";
import {
  streamScouting,
  hashOpponentSnapshot,
} from "@/lib/ai/opponent-scouting";
import { getCachedScouting } from "@/lib/ai/opponent-scouting/cache";
import type { TeamPokemon } from "@/lib/types/pokemon";

/**
 * POST /api/opponent-scouting
 *
 * Body: {
 *   opponentTeam: Partial<TeamPokemon>[],
 *   myTeam?: TeamPokemon[],
 *   myBrought?: string[],
 *   format?: string,
 *   forceRefresh?: boolean,
 * }
 *
 * Streams SSE: "start", "node" (per step), "done", "error".
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const opponentTeam: Partial<TeamPokemon>[] = body.opponentTeam ?? [];
    const myTeam: TeamPokemon[] = body.myTeam ?? [];
    const myBrought: string[] = body.myBrought ?? [];
    const format: string = body.format ?? "champions-reg-m-a";
    const forceRefresh: boolean = Boolean(body.forceRefresh);

    if (!Array.isArray(opponentTeam) || opponentTeam.length === 0) {
      return NextResponse.json(
        { error: "opponentTeam is required and must be non-empty" },
        { status: 400 },
      );
    }

    const hash = hashOpponentSnapshot(opponentTeam, format);

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
          send("start", {
            hash,
            opponentSpecies: opponentTeam.map((p) => p.species),
            format,
          });

          // Positive-cache hit: emit a synthesized "done" with the cached
          // result, no graph invocation.
          if (!forceRefresh) {
            const cached = getCachedScouting(hash);
            if (cached) {
              send("cache-hit", { hash });
              send("done", { result: cached, hash, fromCache: true });
              return;
            }
          }

          let lastState: Record<string, unknown> = {};

          for await (const { node, state } of streamScouting({
            opponentTeam,
            myTeam,
            myBrought,
            format,
            forceRefresh,
          })) {
            const s = state as Record<string, unknown>;
            lastState = { ...lastState, ...s };
            // Whitelist per-node fields so we don't dump the whole state.
            send("node", {
              node,
              data: {
                archetype: s.archetype,
                teamSynergies: s.teamSynergies,
                speedControl: s.speedControl,
                research: s.research,
                predictions: s.predictions,
                wolfeNote: s.wolfeNote,
                cybertronNote: s.cybertronNote,
                suggestedLeads: s.suggestedLeads,
                watchFor: s.watchFor,
                suggestedWinConditions: s.suggestedWinConditions,
                synthesis: s.synthesis,
              },
            });
          }

          const result = {
            predictedSets: lastState.predictions ?? [],
            archetype: lastState.archetype ?? "",
            teamSynergies: lastState.teamSynergies ?? [],
            suggestedLeads: lastState.suggestedLeads ?? [],
            watchFor: lastState.watchFor ?? [],
            suggestedWinConditions: lastState.suggestedWinConditions ?? [],
            wolfeNote: lastState.wolfeNote ?? "",
            cybertronNote: lastState.cybertronNote ?? "",
            synthesis: lastState.synthesis ?? "",
            generatedAt: Date.now(),
            reruns: 0,
          };

          send("done", { result, hash, fromCache: false });
        } catch (err: unknown) {
          send("error", {
            message: (err as Error).message ?? "Unknown scouting error",
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
