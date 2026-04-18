import { aggregateFromPikalytics } from "@/lib/meta-teams/aggregator-pikalytics";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/meta-teams/aggregate
 *
 * Body (optional): { format?, internalFormat?, topN?, source?: "pikalytics" | "all" }
 *
 * Triggers meta-team ingestion from external sources. MVP: Pikalytics
 * only. Safe to call repeatedly — the meta_teams table dedupes on
 * (fingerprint, source). Returns a summary.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const format: string | undefined = body?.format;
    const internalFormat: string | undefined = body?.internalFormat;
    const topN: number | undefined =
      typeof body?.topN === "number" ? body.topN : undefined;

    const result = await aggregateFromPikalytics({ format, internalFormat, topN });
    return Response.json(result);
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
