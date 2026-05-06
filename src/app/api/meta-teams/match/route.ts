import { matchMetaTeams } from "@/lib/meta-teams/queries";

export const runtime = "nodejs";

/**
 * POST /api/meta-teams/match
 *
 * Body: { species: string[], format?: string, minOverlap?: number, limit?: number }
 *
 * Returns ranked matches for the partial species list — used at OTS
 * entry time to show "X known teams match so far, tap to see the rest".
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const species = Array.isArray(body?.species)
      ? (body.species as unknown[]).filter((s): s is string => typeof s === "string")
      : [];
    if (species.length === 0) {
      return Response.json({ matches: [] });
    }

    const format =
      typeof body?.format === "string" ? body.format : "champions-reg-m-a";
    const minOverlap =
      typeof body?.minOverlap === "number" && body.minOverlap >= 1
        ? Math.min(6, Math.floor(body.minOverlap))
        : 2;
    const limit =
      typeof body?.limit === "number" && body.limit > 0
        ? Math.min(50, Math.floor(body.limit))
        : 10;

    const matches = await matchMetaTeams({ species, format, minOverlap, limit });
    return Response.json({ matches });
  } catch (err) {
    console.error("POST /api/meta-teams/match error:", err);
    return Response.json(
      { error: "Failed to match meta teams" },
      { status: 500 },
    );
  }
}
