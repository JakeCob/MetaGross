import { NextResponse } from "next/server";
import { streamTeamDebate } from "@/lib/ai/team-debate";
import type { AITeamMember } from "@/lib/team-analysis/team-context";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

export const runtime = "nodejs";
// Full-team build + EV optimization on all 6 is long-running. 300s is the
// platform max; very large builds may still need a background job in prod.
export const maxDuration = 300;

/**
 * POST /api/teams/debate
 *
 * Runs the multi-agent team-building debate and streams progress as SSE:
 *   propose → offense → defense → analyst → critic → (revise…) → finalize.
 * Emits a `node` event per agent turn, then a `done` event with the final
 * team + summary + full transcript.
 *
 * Body: { seed?: AITeamMember[], brief?: string, format?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const seed: AITeamMember[] = Array.isArray(body?.seed) ? body.seed : [];
    const brief: string = typeof body?.brief === "string" ? body.brief : "";
    const format: string =
      typeof body?.format === "string" && body.format.trim()
        ? body.format
        : ACTIVE_REGULATION_FORMAT_ID;

    const labels: Record<string, string> = {
      propose_team: "propose",
      offense_architect: "offense",
      defense_architect: "defense",
      meta_analyst: "analyst",
      critic_judge: "critic",
      finalize: "finalize",
    };

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (event: string, data: unknown) =>
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );

        try {
          send("start", { seed: seed.map((m) => m.species), format });

          let last: Record<string, unknown> = {};
          for await (const { node, state } of streamTeamDebate({
            seed,
            brief,
            format,
          })) {
            const s = state as Record<string, unknown>;
            last = { ...last, ...s };
            send("node", {
              node: labels[node] ?? node,
              data: {
                draft: s.draft ?? undefined,
                offenseReview: s.offenseReview ?? undefined,
                defenseReview: s.defenseReview ?? undefined,
                analystReview: s.analystReview ?? undefined,
                critique: s.critique ?? undefined,
                violations: s.violations ?? undefined,
                transcript: s.transcript ?? undefined,
                round: s.round ?? undefined,
                finalTeam: s.finalTeam ?? undefined,
                finalSummary: s.finalSummary ?? undefined,
              },
            });
          }

          send("done", {
            team: last.finalTeam ?? last.draft ?? [],
            summary: last.finalSummary ?? "",
            transcript: last.transcript ?? [],
            violations: last.violations ?? [],
            rounds: last.round ?? 1,
          });
        } catch (err) {
          send("error", { message: (err as Error).message ?? "Unknown error" });
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
