import {
  getChampionsTournaments,
  getTournamentStandings,
} from "@/lib/pokemon/limitless";

/**
 * GET /api/tournaments
 *
 * Query params:
 *   (none)            -> list recent Champions M-A tournaments
 *   ?id=TOURNAMENT_ID -> get standings + team lists for a specific tournament
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get("id");

    const cacheHeaders = {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    };

    // Get standings for a specific tournament
    if (tournamentId) {
      const standings = await getTournamentStandings(tournamentId);
      return Response.json(
        { tournamentId, standings },
        { headers: cacheHeaders },
      );
    }

    // List recent tournaments
    const tournaments = await getChampionsTournaments();
    return Response.json(
      { tournaments },
      { headers: cacheHeaders },
    );
  } catch (error) {
    console.error("GET /api/tournaments error:", error);
    return Response.json(
      { error: "Failed to fetch tournament data" },
      { status: 500 },
    );
  }
}
