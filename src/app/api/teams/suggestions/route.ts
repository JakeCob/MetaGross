import {
  getPikalyticsTopUsage,
  getPikalyticsPokemonDetail,
  DEFAULT_PIKALYTICS_FORMAT,
} from "@/lib/pokemon/pikalytics";
import {
  generateTeamSuggestions,
  type MetaEntry,
} from "@/lib/team-analysis/suggestions";

/**
 * POST /api/teams/suggestions
 *
 * Accepts a partial team (species names) and returns heuristic suggestions
 * for filling the remaining slots.
 *
 * Body: { team: string[], format?: string }
 * Response: { suggestions: TeamSuggestion[] }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const team: string[] = body.team ?? [];
    const format: string = body.format ?? DEFAULT_PIKALYTICS_FORMAT;

    if (!Array.isArray(team) || team.length === 0) {
      return Response.json(
        { error: "team must be a non-empty array of species names" },
        { status: 400 },
      );
    }

    // Fetch top usage data to identify meta Pokemon
    const topUsage = await getPikalyticsTopUsage(format);

    // Fetch detailed data (teammates) for each team member + top meta Pokemon
    const speciesToFetch = new Set<string>(team);
    for (const entry of topUsage.slice(0, 30)) {
      speciesToFetch.add(entry.species);
    }

    const detailPromises = [...speciesToFetch].map(async (species) => {
      const detail = await getPikalyticsPokemonDetail(species, format);
      return detail;
    });

    const details = await Promise.all(detailPromises);

    // Build meta data array
    const metaData: MetaEntry[] = [];
    for (const entry of topUsage) {
      const detail = details.find(
        (d) => d && d.species.toLowerCase() === entry.species.toLowerCase(),
      );
      metaData.push({
        species: entry.species,
        usage: entry.usagePercent,
        teammates: detail?.teammates ?? [],
      });
    }

    // Also add team members that might not be in top usage
    for (const species of team) {
      if (metaData.some((e) => e.species.toLowerCase() === species.toLowerCase())) {
        continue;
      }
      const detail = details.find(
        (d) => d && d.species.toLowerCase() === species.toLowerCase(),
      );
      if (detail) {
        metaData.push({
          species: detail.species,
          teammates: detail.teammates,
        });
      }
    }

    const suggestions = generateTeamSuggestions(team, metaData);

    return Response.json(
      { suggestions },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    console.error("POST /api/teams/suggestions error:", error);
    return Response.json(
      { error: "Failed to generate suggestions" },
      { status: 500 },
    );
  }
}
