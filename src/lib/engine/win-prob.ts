/**
 * Heuristic-based win probability calculator for VGC battles.
 *
 * Returns a value 0-100 representing P1's win probability.
 * Uses a weighted sum of multiple factors normalized to 0-100.
 */

import type { FieldState } from "@/lib/types/battle";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { getSpecies } from "@/lib/pokemon/species";
import { getMove } from "@/lib/pokemon/moves";
import { getTypeEffectiveness } from "@/lib/pokemon/types";
import { getEffectiveSpeed } from "./speed-calc";

export interface GameState {
  p1Pokemon: { species: string; hpPercent: number; isFainted: boolean }[];
  p2Pokemon: { species: string; hpPercent: number; isFainted: boolean }[];
  fieldState: FieldState;
  p1Team: TeamPokemon[];
  p2Team: TeamPokemon[];
}

// Weights for each heuristic factor
const WEIGHT_POKEMON_COUNT = 0.30;
const WEIGHT_HP_DIFFERENTIAL = 0.25;
const WEIGHT_TYPE_MATCHUP = 0.20;
const WEIGHT_SPEED_CONTROL = 0.15;
const WEIGHT_FIELD_ADVANTAGE = 0.10;

/**
 * Calculate heuristic win probability from P1's perspective.
 * Returns 0-100 clamped to 5-95 unless one side has zero Pokemon alive (then 0 or 100).
 */
export function calculateWinProbability(state: GameState): number {
  const p1Alive = state.p1Pokemon.filter((p) => !p.isFainted);
  const p2Alive = state.p2Pokemon.filter((p) => !p.isFainted);

  // Edge cases: one side completely eliminated
  if (p1Alive.length === 0) return 0;
  if (p2Alive.length === 0) return 100;

  // Calculate each factor as a value from 0 to 1 (0.5 = even)
  const countScore = calcPokemonCountScore(p1Alive.length, p2Alive.length);
  const hpScore = calcHpDifferentialScore(p1Alive, p2Alive);
  const typeScore = calcTypeMatchupScore(
    p1Alive,
    p2Alive,
    state.p1Team,
    state.p2Team,
  );
  const speedScore = calcSpeedControlScore(
    p1Alive,
    p2Alive,
    state.p1Team,
    state.p2Team,
    state.fieldState,
  );
  const fieldScore = calcFieldAdvantageScore(
    p1Alive,
    p2Alive,
    state.p1Team,
    state.p2Team,
    state.fieldState,
  );

  // Weighted average: each score is 0-1 where 0.5 = even
  const rawProb =
    countScore * WEIGHT_POKEMON_COUNT +
    hpScore * WEIGHT_HP_DIFFERENTIAL +
    typeScore * WEIGHT_TYPE_MATCHUP +
    speedScore * WEIGHT_SPEED_CONTROL +
    fieldScore * WEIGHT_FIELD_ADVANTAGE;

  // Amplify differences from 0.5 using a sigmoid-like curve.
  // This makes strong advantages more pronounced while keeping
  // balanced positions near 50%.
  const centered = rawProb - 0.5; // -0.5 to 0.5
  const amplified = 0.5 + Math.sign(centered) * Math.pow(Math.abs(centered) * 2, 0.7) / 2;

  // Convert 0-1 to 0-100
  const probability = amplified * 100;

  // Clamp to 5-95 when both sides have Pokemon
  return Math.round(Math.min(95, Math.max(5, probability)));
}

/**
 * Pokemon count advantage.
 * 4v2 strongly favors the side with more; equal counts = 0.5.
 */
function calcPokemonCountScore(p1Count: number, p2Count: number): number {
  if (p1Count + p2Count === 0) return 0.5;
  return p1Count / (p1Count + p2Count);
}

/**
 * HP differential: total remaining HP% across all alive Pokemon.
 */
function calcHpDifferentialScore(
  p1Alive: GameState["p1Pokemon"],
  p2Alive: GameState["p2Pokemon"],
): number {
  const p1TotalHp = p1Alive.reduce((sum, p) => sum + p.hpPercent, 0);
  const p2TotalHp = p2Alive.reduce((sum, p) => sum + p.hpPercent, 0);

  const total = p1TotalHp + p2TotalHp;
  if (total === 0) return 0.5;

  return p1TotalHp / total;
}

/**
 * Type matchup favorability.
 * For each remaining P1 Pokemon, count how many P2 Pokemon it has a
 * super-effective STAB move against. Do the same for P2. Compare ratios.
 */
function calcTypeMatchupScore(
  p1Alive: GameState["p1Pokemon"],
  p2Alive: GameState["p2Pokemon"],
  p1Team: TeamPokemon[],
  p2Team: TeamPokemon[],
): number {
  const p1Coverage = countCoverage(p1Alive, p2Alive, p1Team, p2Team);
  const p2Coverage = countCoverage(p2Alive, p1Alive, p2Team, p1Team);

  const total = p1Coverage + p2Coverage;
  if (total === 0) return 0.5;

  return p1Coverage / total;
}

/**
 * Count how many opponent Pokemon an attacking side has super-effective STAB coverage against.
 */
function countCoverage(
  attackerAlive: GameState["p1Pokemon"],
  defenderAlive: GameState["p1Pokemon"],
  attackerTeam: TeamPokemon[],
  defenderTeam: TeamPokemon[],
): number {
  let coverage = 0;

  for (const attacker of attackerAlive) {
    const teamMon = attackerTeam.find(
      (t) => t.species === attacker.species,
    );
    if (!teamMon) continue;

    const attackerSpecies = getSpecies(teamMon.species);
    if (!attackerSpecies) continue;

    // Get STAB types
    const stabTypes = attackerSpecies.types;

    // Get move types for this Pokemon
    const moveTypes: string[] = [];
    for (const moveName of teamMon.moves) {
      const moveData = getMove(moveName);
      if (moveData && moveData.basePower > 0) {
        moveTypes.push(moveData.type);
      }
    }

    // STAB moves = moves that match one of the Pokemon's types
    const stabMoveTypes = moveTypes.filter((mt) => stabTypes.includes(mt));

    for (const defender of defenderAlive) {
      const defTeamMon = defenderTeam.find(
        (t) => t.species === defender.species,
      );
      const defSpecies = defTeamMon
        ? getSpecies(defTeamMon.species)
        : getSpecies(defender.species);
      if (!defSpecies) continue;

      // Check if any STAB move is super-effective against the defender
      const hasSuperEffective = stabMoveTypes.some((moveType) => {
        const effectiveness = getTypeEffectiveness(moveType, defSpecies.types);
        return effectiveness >= 2;
      });

      if (hasSuperEffective) {
        coverage++;
      }
    }
  }

  return coverage;
}

/**
 * Speed control advantage.
 * Compare average effective speed of remaining Pokemon.
 * Factor in Trick Room and Tailwind.
 */
function calcSpeedControlScore(
  p1Alive: GameState["p1Pokemon"],
  p2Alive: GameState["p2Pokemon"],
  p1Team: TeamPokemon[],
  p2Team: TeamPokemon[],
  fieldState: FieldState,
): number {
  const p1AvgSpeed = calcAverageSpeed(p1Alive, p1Team, fieldState, "p1");
  const p2AvgSpeed = calcAverageSpeed(p2Alive, p2Team, fieldState, "p2");

  const total = p1AvgSpeed + p2AvgSpeed;
  if (total === 0) return 0.5;

  // In trick room, the slower side has the advantage
  if (fieldState.trickRoom) {
    return p2AvgSpeed / total; // Invert: slower = better
  }

  return p1AvgSpeed / total;
}

function calcAverageSpeed(
  alive: GameState["p1Pokemon"],
  team: TeamPokemon[],
  fieldState: FieldState,
  side: "p1" | "p2",
): number {
  let totalSpeed = 0;
  let count = 0;

  for (const pokemon of alive) {
    const teamMon = team.find((t) => t.species === pokemon.species);
    if (!teamMon) continue;

    totalSpeed += getEffectiveSpeed(teamMon, fieldState, null, side);
    count++;
  }

  return count > 0 ? totalSpeed / count : 0;
}

/**
 * Field advantage: weather/terrain that benefits one side's types.
 */
function calcFieldAdvantageScore(
  p1Alive: GameState["p1Pokemon"],
  p2Alive: GameState["p2Pokemon"],
  p1Team: TeamPokemon[],
  p2Team: TeamPokemon[],
  fieldState: FieldState,
): number {
  let p1Advantage = 0;
  let p2Advantage = 0;

  // Weather benefits
  if (fieldState.weather) {
    p1Advantage += countWeatherBenefits(p1Alive, p1Team, fieldState.weather);
    p2Advantage += countWeatherBenefits(p2Alive, p2Team, fieldState.weather);
  }

  // Terrain benefits
  if (fieldState.terrain) {
    p1Advantage += countTerrainBenefits(p1Alive, p1Team, fieldState.terrain);
    p2Advantage += countTerrainBenefits(p2Alive, p2Team, fieldState.terrain);
  }

  // Screens
  if (fieldState.screensP1.reflect || fieldState.screensP1.lightScreen || fieldState.screensP1.auroraVeil) {
    p1Advantage += 1;
  }
  if (fieldState.screensP2.reflect || fieldState.screensP2.lightScreen || fieldState.screensP2.auroraVeil) {
    p2Advantage += 1;
  }

  const total = p1Advantage + p2Advantage;
  if (total === 0) return 0.5;

  return (p1Advantage + 0.5 * total) / (2 * total);
}

function countWeatherBenefits(
  alive: GameState["p1Pokemon"],
  team: TeamPokemon[],
  weather: NonNullable<FieldState["weather"]>,
): number {
  let benefits = 0;

  // Type-based weather benefits
  const weatherTypeBoosts: Record<string, string> = {
    rain: "Water",
    sun: "Fire",
    sand: "Rock",
    snow: "Ice",
  };

  const boostedType = weatherTypeBoosts[weather];

  for (const pokemon of alive) {
    const teamMon = team.find((t) => t.species === pokemon.species);
    if (!teamMon) continue;

    const species = getSpecies(teamMon.species);
    if (!species) continue;

    // Check if the Pokemon has the boosted type
    if (boostedType && species.types.includes(boostedType)) {
      benefits += 1;
    }

    // Check for weather-boosting abilities
    const weatherAbilities: Record<string, string[]> = {
      rain: ["Swift Swim", "Rain Dish", "Hydration"],
      sun: ["Chlorophyll", "Solar Power", "Flower Gift"],
      sand: ["Sand Rush", "Sand Force"],
      snow: ["Slush Rush", "Ice Body"],
    };

    if (weatherAbilities[weather]?.includes(teamMon.ability)) {
      benefits += 1;
    }
  }

  return benefits;
}

function countTerrainBenefits(
  alive: GameState["p1Pokemon"],
  team: TeamPokemon[],
  terrain: NonNullable<FieldState["terrain"]>,
): number {
  let benefits = 0;

  const terrainTypeBoosts: Record<string, string> = {
    electric: "Electric",
    grassy: "Grass",
    psychic: "Psychic",
    misty: "Fairy",
  };

  const boostedType = terrainTypeBoosts[terrain];

  for (const pokemon of alive) {
    const teamMon = team.find((t) => t.species === pokemon.species);
    if (!teamMon) continue;

    const species = getSpecies(teamMon.species);
    if (!species) continue;

    if (boostedType && species.types.includes(boostedType)) {
      benefits += 1;
    }
  }

  return benefits;
}
