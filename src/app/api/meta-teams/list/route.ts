import { NextResponse } from "next/server";
import { listMetaTeams, countMetaTeams } from "@/lib/meta-teams/queries";
import { getRegulation } from "@/lib/data/champions";

export const runtime = "nodejs";

/** Champions Reg M-A — the fallback pool when the requested reg has no teams
 *  indexed yet (e.g. a brand-new reg with no tournaments on Limitless). */
const FALLBACK_FORMAT_ID = "champions-reg-m-a";

/**
 * GET /api/meta-teams/list?format=<label|id>&limit=<n>
 *
 * Returns proven tournament/creator teams for the "Browse proven teams" view.
 * Resolves the format label → internal id, and if the requested reg has nothing
 * indexed yet, gracefully falls back to the previous reg (M-A) so tournament
 * players can still reference + adapt proven lists.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? undefined;
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? "24", 10) || 24, 1),
      60,
    );

    const requestedId = getRegulation(format).formatId;
    let teams = await listMetaTeams(requestedId, limit);
    let usedFormatId = requestedId;
    let fallback = false;

    if (teams.length === 0 && requestedId !== FALLBACK_FORMAT_ID) {
      const fb = await listMetaTeams(FALLBACK_FORMAT_ID, limit);
      if (fb.length > 0) {
        teams = fb;
        usedFormatId = FALLBACK_FORMAT_ID;
        fallback = true;
      }
    }

    const counts = await countMetaTeams(usedFormatId);

    return NextResponse.json({
      teams,
      requestedFormatId: requestedId,
      usedFormatId,
      fallback,
      counts,
    });
  } catch (err) {
    console.error("GET /api/meta-teams/list error:", err);
    return NextResponse.json(
      { error: "Failed to load proven teams." },
      { status: 500 },
    );
  }
}
