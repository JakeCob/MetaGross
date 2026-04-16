/**
 * Researcher — pure compute node (no LLM cost).
 *
 * Phase 2: wires Pikalytics + creator-teams for each opponent species.
 * Returns gracefully-degraded entries when Pikalytics is unreachable
 * (negative-cached — the existing pikalytics module handles this).
 */
import { getPikalyticsPokemonDetail } from "@/lib/pokemon/pikalytics";
import { CREATOR_TEAMS } from "@/lib/data/creator-teams";
import type { ScoutingStateType, ScoutingStateUpdate } from "../state";
import type { ResearchFinding } from "../state";

function mapFormatToPikalytics(format: string): string {
  const lc = format.toLowerCase();
  if (lc.startsWith("champions")) return "championspreview";
  if (lc.includes("reg-i")) return "gen9vgc2026regi";
  if (lc.includes("reg-f")) return "gen9vgc2026regf";
  return "championspreview";
}

export async function researcherNode(
  state: ScoutingStateType,
): Promise<Partial<ScoutingStateUpdate>> {
  const pikaFormat = mapFormatToPikalytics(state.format);
  const opponentSpecies = Array.from(
    new Set(state.opponentTeam.map((p) => p.species ?? "").filter(Boolean)),
  );

  const findings: ResearchFinding[] = await Promise.all(
    opponentSpecies.map(async (species) => {
      const detail = await getPikalyticsPokemonDetail(species, pikaFormat);

      // Find creator teams whose roster overlaps with this opponent on
      // *at least 3* species. That keeps it relevant without false
      // positives from shared Incineroars.
      const oppSet = new Set(opponentSpecies);
      const creatorMatches = CREATOR_TEAMS.flatMap((team) => {
        const teamSpecies = team.pokemon.map((p) => p.species);
        const overlap = teamSpecies.filter((s) => oppSet.has(s));
        if (overlap.length < 3 || !teamSpecies.includes(species)) return [];
        return [
          {
            creator: team.creator,
            archetype: team.archetype,
            title: team.title,
            pokemon: teamSpecies,
          },
        ];
      }).slice(0, 3);

      if (!detail) {
        return {
          species,
          creatorMatches: creatorMatches.length ? creatorMatches : undefined,
          degraded: true,
        };
      }

      return {
        species,
        pikalyticsMoves: detail.moves.slice(0, 8),
        pikalyticsAbilities: detail.abilities.slice(0, 4),
        pikalyticsItems: detail.items.slice(0, 5),
        pikalyticsTeammates: detail.teammates.slice(0, 6),
        creatorMatches: creatorMatches.length ? creatorMatches : undefined,
      };
    }),
  );

  return {
    research: findings,
    history: [
      {
        source: "researcher",
        summary: `researched ${findings.length} species (${findings.filter((f) => f.degraded).length} degraded)`,
        at: Date.now(),
      },
    ],
  };
}
