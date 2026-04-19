import { aggregateFromPikalytics } from "@/lib/meta-teams/aggregator-pikalytics";
import { aggregateFromLimitless } from "@/lib/meta-teams/aggregator-limitless";
import { aggregateFromCreators } from "@/lib/meta-teams/aggregator-creators";

export const runtime = "nodejs";
export const maxDuration = 180;

type Source = "all" | "limitless" | "pikalytics" | "creators";

/**
 * POST /api/meta-teams/aggregate
 *
 * Body (optional):
 *   { source?: "all" | "limitless" | "pikalytics" | "creators",
 *     format?, internalFormat?,
 *     topN?,                 // Pikalytics: top-N most-used species to walk
 *     topTournaments?, topCut?, minPlayers?  // Limitless tuning
 *   }
 *
 * Default source: "all" — runs every aggregator. Safe to call
 * repeatedly; meta_teams dedupes on (fingerprint, source).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const source: Source =
      body?.source === "limitless" ||
      body?.source === "pikalytics" ||
      body?.source === "creators"
        ? body.source
        : "all";
    const format: string | undefined = body?.format;
    const internalFormat: string | undefined = body?.internalFormat;
    const topN: number | undefined =
      typeof body?.topN === "number" ? body.topN : undefined;
    const topTournaments: number | undefined =
      typeof body?.topTournaments === "number" ? body.topTournaments : undefined;
    const topCut: number | undefined =
      typeof body?.topCut === "number" ? body.topCut : undefined;
    const minPlayers: number | undefined =
      typeof body?.minPlayers === "number" ? body.minPlayers : undefined;

    const output: Record<string, unknown> = {};

    if (source === "creators" || source === "all") {
      output.creators = aggregateFromCreators({
        format: internalFormat,
      });
    }

    if (source === "limitless" || source === "all") {
      output.limitless = await aggregateFromLimitless({
        internalFormat,
        topTournaments,
        topCut,
        minPlayers,
      });
    }

    if (source === "pikalytics" || source === "all") {
      output.pikalytics = await aggregateFromPikalytics({
        format,
        internalFormat,
        topN,
      });
    }

    return Response.json({ source, ...output });
  } catch (err) {
    console.error("POST /api/meta-teams/aggregate error:", err);
    return Response.json(
      {
        error: "Failed to aggregate meta teams",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
