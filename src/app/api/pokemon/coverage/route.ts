import { getSpecies } from "@/lib/pokemon/species";
import { computeCoverage, type CoverageMember } from "@/lib/pokemon/type-coverage";

export const runtime = "nodejs";

interface CoverageRequestMon {
  species?: string;
  ability?: string;
}

/**
 * POST /api/pokemon/coverage
 *
 * Body: { team: { species, ability? }[] }
 * Resolves each species to its typing (server-only @pkmn) and returns the
 * team's defensive coverage matrix (per attacking type: weak/resist/immune
 * counts + per-member multipliers + shared weaknesses).
 *
 * Typing is the base species' — invented Champions mega forms aren't in the
 * dex, so we fall back to base typing (the established pattern).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const team: CoverageRequestMon[] = Array.isArray(body?.team) ? body.team : [];

    const members: CoverageMember[] = [];
    const unresolved: string[] = [];
    for (const mon of team) {
      const species = mon?.species?.trim();
      if (!species) continue;
      const data = getSpecies(species);
      if (!data) {
        unresolved.push(species);
        continue;
      }
      members.push({
        species: data.name,
        types: data.types,
        ability: mon.ability?.trim() || undefined,
      });
    }

    if (members.length === 0) {
      return Response.json(
        { error: "Provide a team with at least one resolvable Pokémon." },
        { status: 400 },
      );
    }

    const coverage = computeCoverage(members);
    return Response.json({ coverage, unresolved });
  } catch (error) {
    console.error("POST /api/pokemon/coverage error:", error);
    return Response.json(
      { error: "Failed to compute coverage" },
      { status: 500 },
    );
  }
}
