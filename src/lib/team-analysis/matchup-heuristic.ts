/**
 * Team-vs-meta matchup heuristic — the single source of truth for "how does
 * this team hold up against the current top-cut teams?".
 *
 * NOT a battle sim: a type-coverage + speed-tier heuristic over real Limitless
 * top-cut decklists. Extracted here so BOTH the `simulate_vs_top_teams` agent
 * tool AND the team-building suggester reuse the same logic instead of
 * duplicating it.
 *
 * Server-only — pulls Limitless data + @pkmn/dex.
 */
import "server-only";

import {
  getChampionsTournaments,
  getTournamentStandings,
} from "@/lib/pokemon/limitless";
import { getSpecies } from "@/lib/pokemon/species";
import { getTypeEffectiveness } from "@/lib/pokemon/types";

export interface MatchupScore {
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

export interface TeamMatchupReport {
  team: string[];
  tournamentsSampled: { id: string; name: string; date: string; players: number }[];
  teamsEvaluated: number;
  averageScore: number;
  worstMatchups: MatchupScore[];
  bestMatchups: MatchupScore[];
}

function typesOf(species: string): string[] {
  return getSpecies(species)?.types ?? [];
}

function baseSpeedOf(species: string): number {
  return getSpecies(species)?.baseStats.spe ?? 0;
}

/**
 * Score how well `attacker` pressures a whole `defenders[]`.
 * 1 = every opposing Pokemon takes super-effective damage from at least one of
 * attacker's STAB types; 0 = nothing hits.
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

/** Worst super-effectiveness the team takes from the opponent's types (1-4). */
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

/**
 * Score a team against recent Champions top-cut teams from Limitless.
 * Returns a report (worst/best matchups + average) or `{ error }` when the
 * data can't be fetched. Pure data — no AI.
 */
export async function scoreTeamVsTopTeams(
  team: string[],
  opts: { tournamentLimit?: number; topCutSize?: number } = {},
): Promise<TeamMatchupReport | { error: string }> {
  const { tournamentLimit = 3, topCutSize = 8 } = opts;

  const myTypes = team.map((s) => typesOf(s));
  const mySpeed = team.map((s) => baseSpeedOf(s));

  if (myTypes.every((t) => t.length === 0)) {
    return {
      error:
        "None of the species resolved in @pkmn/dex — check spellings. Example: 'Scovillain-Mega', not 'Mega Scovillain'.",
    };
  }

  const tournaments = await getChampionsTournaments();
  const selected = tournaments.slice(0, tournamentLimit);
  if (selected.length === 0) {
    return {
      error:
        "Limitless returned no recent Champions tournaments. Try again later, or skip simulation and cite usage stats via get_meta_data instead.",
    };
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

      const offenseCoverages = myTypes.map((t) =>
        t.length > 0 ? offenseScore(t, oppTypes) : 0,
      );
      const offenseCoverage =
        offenseCoverages.reduce((sum, v) => sum + v, 0) /
        offenseCoverages.length;

      const defenseVulnerabilityScores = oppTypes.map((t) =>
        t.length > 0 ? defenseScore(myTypes, t) : 0,
      );
      const defenseVulnerability =
        defenseVulnerabilityScores.reduce((sum, v) => sum + v, 0) /
        defenseVulnerabilityScores.length;

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
    return {
      error:
        "Fetched tournaments but none had decklists attached. Simulation is unavailable — fall back to meta-usage reasoning.",
    };
  }

  matchups.sort((a, b) => a.score - b.score);
  const average =
    Math.round(
      (matchups.reduce((sum, m) => sum + m.score, 0) / matchups.length) * 10,
    ) / 10;

  return {
    team,
    tournamentsSampled: selected.map((t) => ({
      id: t.id,
      name: t.name,
      date: t.date,
      players: t.players,
    })),
    teamsEvaluated: matchups.length,
    averageScore: average,
    worstMatchups: matchups.slice(0, 5),
    bestMatchups: matchups.slice(-3).reverse(),
  };
}
