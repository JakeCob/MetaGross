import { CREATOR_TEAMS, CREATORS } from "@/lib/data/creator-teams";

/**
 * GET /api/team-archive/creators
 *
 * Query params:
 *   ?creator=name    -> filter teams by creator name (case-insensitive, partial match)
 *   ?archetype=rain  -> filter teams by archetype (case-insensitive, partial match)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorFilter = searchParams.get("creator");
    const archetypeFilter = searchParams.get("archetype");

    let teams = CREATOR_TEAMS;

    if (creatorFilter) {
      const needle = creatorFilter.toLowerCase();
      teams = teams.filter(
        (t) =>
          t.creator.toLowerCase().includes(needle) ||
          t.creatorHandle.toLowerCase().includes(needle),
      );
    }

    if (archetypeFilter) {
      const needle = archetypeFilter.toLowerCase();
      teams = teams.filter((t) =>
        t.archetype.toLowerCase().includes(needle),
      );
    }

    return Response.json(
      { creators: CREATORS, teams },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/team-archive/creators error:", error);
    return Response.json(
      { error: "Failed to fetch creator teams" },
      { status: 500 },
    );
  }
}
