import { aggregateFromPikalytics } from "@/lib/meta-teams/aggregator-pikalytics";
import { aggregateFromLimitless } from "@/lib/meta-teams/aggregator-limitless";
import { aggregateFromCreators } from "@/lib/meta-teams/aggregator-creators";
import { aggregateFromVgcPastes } from "@/lib/meta-teams/aggregator-vgcpastes";
import { isCronRequest } from "@/lib/auth/cron";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/meta-teams/aggregate — cron entry point.
 *
 * Vercel Cron (and other schedulers) issue GET with
 * `Authorization: Bearer <CRON_SECRET>`. Runs every aggregator with
 * defaults (internalFormat = active regulation). Self-authenticates so it
 * stays safe even if the middleware bypass changes.
 */
export async function GET(request: Request) {
  if (!isCronRequest(request.headers)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [creators, limitless, pikalytics, vgcpastes] = await Promise.all([
      aggregateFromCreators({}),
      aggregateFromLimitless({}),
      aggregateFromPikalytics({}),
      aggregateFromVgcPastes({}),
    ]);
    return Response.json({
      source: "all",
      trigger: "cron",
      creators,
      limitless,
      pikalytics,
      vgcpastes,
    });
  } catch (err) {
    console.error("GET /api/meta-teams/aggregate (cron) error:", err);
    return Response.json(
      {
        error: "Failed to aggregate meta teams",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

type Source = "all" | "limitless" | "pikalytics" | "creators" | "vgcpastes";

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
      body?.source === "creators" ||
      body?.source === "vgcpastes"
        ? body.source
        : "all";
    const vgcPastesLimit: number | undefined =
      typeof body?.vgcPastesLimit === "number" ? body.vgcPastesLimit : undefined;
    const vgcPastesMaxAgeDays: number | undefined =
      typeof body?.vgcPastesMaxAgeDays === "number"
        ? body.vgcPastesMaxAgeDays
        : undefined;
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
      output.creators = await aggregateFromCreators({
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

    if (source === "vgcpastes" || source === "all") {
      output.vgcpastes = await aggregateFromVgcPastes({
        internalFormat,
        limit: vgcPastesLimit,
        maxAgeDays: vgcPastesMaxAgeDays,
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
