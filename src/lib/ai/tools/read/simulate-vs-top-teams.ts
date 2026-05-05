import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  getChampionsTournaments,
  getTournamentStandings,
} from "@/lib/pokemon/limitless";
import { getSpecies } from "@/lib/pokemon/species";
import { getTypeEffectiveness } from "@/lib/pokemon/types";

/**
 * Lightweight simulation — NOT a battle sim. It's a type-matchup +
 * speed-tier heuristic that gives a rough "how does my team hold up
 * vs the current top cut?" read. The agent uses the output to write
 * a matchup section in its response, not to decide W/L with precision.
 */
interface MatchupScore {
  opponentTeam: string[];
  opponentPlacement: number;
  opponentPlayer: string;
  opponentEvent?: string;
  score: number;
  offenseCoverage: number;
  defenseVulnerability: number;
  speedAdvantage: number;
  summary: string;
}

function typesOf(species: string): string[] {
  const data = getSpecies(species);
  return data?.types ?? [];
}

function baseSpeedOf(species: string): number {
  const data = getSpecies(species);
  return data?.baseStats.spe ?? 0;
}

/**
 * Score how well `attacker` pressures a whole `defenders[]`.
 * Returns a 0-1 number: 1 means every opposing Pokemon takes super-effective
 * damage from at least one of attacker's STAB types; 0 means nothing hits.
 */
function offenseScore(attacker: string[], defenders: string[][]): number {
  if (defenders.length === 0) return 0;
  let hit = 0;
  for (const defTypes of defenders) {
    const bestMult = Math.max(
      ...attacker.map((atk) => getTypeEffectiveness(atk, defTypes)),
    );
    if (bestMult >= 2) hit += 1;
    else if (bestMult >= 1) hit += 0.4;
  }
  return hit / defenders.length;
}

/**
 * Average super-effective-ness the team takes from the opponent's types.
 * Higher = more vulnerable.
 */
function defenseScore(myTeam: string[][], oppTypes: string[]): number {
  if (myTeam.length === 0 || oppTypes.length === 0) return 0;
  let worst = 0;
  for (const myTypes of myTeam) {
    const mult = Math.max(
      ...oppTypes.map((atk) => getTypeEffectiveness(atk, myTypes)),
    );
    worst = Math.max(worst, mult);
  }
  return worst;
}

export const simulateVsTopTeamsTool = new DynamicStructuredTool({
  name: "simulate_vs_top_teams",
  description:
    "Simulate a proposed team against current Champions top-cut teams from Limitless. Returns per-matchup scores (0-100) with offense/defense/speed breakdowns + a short summary of the worst matchups. Use this AFTER validate_team_build says ok — it tells you which real tournament teams your build loses to, so you can flag those matchups for the user. Sample size: most recent 3 Limitless tournaments, top 8 from each.",
  schema: z.object({
    team: z
      .array(z.string())
      .min(1)
      .max(6)
      .describe("6 species names for the team being evaluated."),
    tournamentLimit: z
      .number()
      .int()
      .min(1)
      .max(5)
      .optional()
      .describe("How many recent tournaments to sample (default 3)."),
    topCutSize: z
      .number()
      .int()
      .min(1)
      .max(16)
      .optional()
      .describe("How many top placements per tournament to include (default 8)."),
  }),
  func: async ({ team, tournamentLimit = 3, topCutSize = 8 }) => {
    // Resolve types + speed for my team.
    const myTypes = team.map((s) => typesOf(s));
    const mySpeed = team.map((s) => baseSpeedOf(s));

    if (myTypes.every((t) => t.length === 0)) {
      return JSON.stringify({
        error:
          "None of the species resolved in @pkmn/dex — check spellings. Example: 'Scovillain-Mega', not 'Mega Scovillain'.",
      });
    }

    // Pull recent top-cut opponent teams.
    const tournaments = await getChampionsTournaments();
    const selected = tournaments.slice(0, tournamentLimit);
    if (selected.length === 0) {
      return JSON.stringify({
        error:
          "Limitless returned no recent Champions tournaments. Try again later, or skip simulation and cite usage stats via get_meta_data instead.",
      });
    }

    const allStandings = await Promise.all(
      selected.map(async (t) => ({
        event: t.name,
        standings: await getTournamentStandings(t.id),
      })),
    );

    const matchups: MatchupScore[] = [];
    for (const { event, standings } of allStandings) {
      for (const entry of standings.slice(0, topCutSize)) {
        if (entry.team.length === 0) continue;
        const oppSpecies = entry.team.map((p) => p.species);
        const oppTypes = oppSpecies.map((s) => typesOf(s));

        // Offense: for each of my Pokemon, how many of theirs take SE?
        const offenseCoverages = myTypes.map((t) =>
          t.length > 0 ? offenseScore(t, oppTypes) : 0,
        );
        const offenseCoverage =
          offenseCoverages.reduce((sum, v) => sum + v, 0) /
          offenseCoverages.length;

        // Defense: how vulnerable is our bulkiest mon to their offense?
        const defenseVulnerabilityScores = oppTypes.map((t) =>
          t.length > 0 ? defenseScore(myTypes, t) : 0,
        );
        const defenseVulnerability =
          defenseVulnerabilityScores.reduce((sum, v) => sum + v, 0) /
          defenseVulnerabilityScores.length;

        // Speed: % of their team we outspeed on average.
        const oppSpeeds = oppSpecies.map((s) => baseSpeedOf(s));
        let speedEdgeCount = 0;
        let speedComparisons = 0;
        for (const ms of mySpeed) {
          for (const os of oppSpeeds) {
            speedComparisons += 1;
            if (ms > os) speedEdgeCount += 1;
          }
        }
        const speedAdvantage =
          speedComparisons > 0 ? speedEdgeCount / speedComparisons : 0.5;

        // Blend into a 0-100 score. Weights: 45% offense, 35% defense
        // (inverse), 20% speed. `defenseVulnerability` is a 1-4 scale
        // — convert to a 0-1 badness factor and subtract.
        const defBadness = Math.min(1, Math.max(0, (defenseVulnerability - 1) / 1.5));
        const score = Math.round(
          100 *
            Math.max(
              0,
              Math.min(
                1,
                0.45 * offenseCoverage +
                  0.35 * (1 - defBadness) +
                  0.2 * speedAdvantage,
              ),
            ),
        );

        const summary =
          score >= 60
            ? "Favourable — strong offensive angles or speed edge."
            : score >= 45
              ? "Close — play around their threats."
              : "Struggle — weak coverage or speed disadvantage; may want a dedicated check.";

        matchups.push({
          opponentTeam: oppSpecies,
          opponentPlayer: entry.name,
          opponentPlacement: entry.placement,
          opponentEvent: event,
          score,
          offenseCoverage: Math.round(offenseCoverage * 100) / 100,
          defenseVulnerability: Math.round(defenseVulnerability * 100) / 100,
          speedAdvantage: Math.round(speedAdvantage * 100) / 100,
          summary,
        });
      }
    }

    if (matchups.length === 0) {
      return JSON.stringify({
        error:
          "Fetched tournaments but none had decklists attached. Simulation is unavailable — fall back to meta-usage reasoning.",
      });
    }

    matchups.sort((a, b) => a.score - b.score);
    const worst = matchups.slice(0, 5);
    const best = matchups.slice(-3).reverse();
    const average =
      Math.round(
        (matchups.reduce((sum, m) => sum + m.score, 0) / matchups.length) * 10,
      ) / 10;

    return JSON.stringify({
      team,
      tournamentsSampled: selected.map((t) => ({
        id: t.id,
        name: t.name,
        date: t.date,
        players: t.players,
      })),
      teamsEvaluated: matchups.length,
      averageScore: average,
      worstMatchups: worst,
      bestMatchups: best,
      nextStep:
        "Cite the worst matchups in your response so the user knows where this team struggles. Offer a concrete tweak (e.g. 'swap slot 3 for a Fairy-resist') if average score < 50.",
    });
  },
});
