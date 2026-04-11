/**
 * EV Benchmark Calculator.
 *
 * Calculates survival, KO, and speed benchmarks for a Pokemon
 * against common meta threats. Suggests optimal EV spreads.
 */

import { calculateDamage, type DamageResult } from "@/lib/engine/damage-calc";
import { getEffectiveSpeed } from "@/lib/engine/speed-calc";
import { getSpecies } from "@/lib/pokemon/species";
import type { TeamPokemon, EVSpread, StatName } from "@/lib/types/pokemon";
import { DEFAULT_EVS, DEFAULT_IVS, MAX_TOTAL_EVS, MAX_SINGLE_EV } from "@/lib/types/pokemon";
import type { Benchmark, BenchmarkReport } from "@/lib/types/ev";

// ---------------------------------------------------------------------------
// MetaThreat type (re-exported for test convenience)
// ---------------------------------------------------------------------------
export interface MetaThreat {
  species: string;
  commonSets: TeamPokemon[];
  usagePercent: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Pick the strongest STAB move from a threat's moveset against our Pokemon. */
function pickStrongestMove(
  threat: TeamPokemon,
  defender: TeamPokemon,
): { move: string; result: DamageResult } | null {
  const threatSpecies = getSpecies(threat.species);
  if (!threatSpecies) return null;

  let best: { move: string; result: DamageResult } | null = null;

  for (const moveName of threat.moves) {
    if (!moveName) continue;
    const result = calculateDamage(threat, defender, moveName, {
      isDoubles: true,
    });
    if (!result) continue;

    if (!best || result.maxPercent > best.result.maxPercent) {
      best = { move: moveName, result };
    }
  }

  return best;
}

/** Pick the strongest move from our Pokemon against a threat. */
function pickOurStrongestMove(
  pokemon: TeamPokemon,
  threat: TeamPokemon,
): { move: string; result: DamageResult } | null {
  let best: { move: string; result: DamageResult } | null = null;

  for (const moveName of pokemon.moves) {
    if (!moveName) continue;
    const result = calculateDamage(pokemon, threat, moveName, {
      isDoubles: true,
    });
    if (!result) continue;

    if (!best || result.maxPercent > best.result.maxPercent) {
      best = { move: moveName, result };
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Benchmark calculations
// ---------------------------------------------------------------------------

function calculateSurvivalBenchmarks(
  pokemon: TeamPokemon,
  threats: MetaThreat[],
): Benchmark[] {
  const benchmarks: Benchmark[] = [];

  for (const threat of threats) {
    for (const set of threat.commonSets) {
      const strongest = pickStrongestMove(set, pokemon);
      if (!strongest) continue;

      const survives = strongest.result.maxPercent < 100;

      benchmarks.push({
        description: survives
          ? `Survives ${set.nature} ${set.evs.atk > set.evs.spa ? set.evs.atk : set.evs.spa} Atk/SpA ${threat.species} ${strongest.move}`
          : `Does NOT survive ${set.nature} ${threat.species} ${strongest.move} (${strongest.result.minPercent.toFixed(1)}-${strongest.result.maxPercent.toFixed(1)}%)`,
        met: survives,
        evRequired: survives
          ? {}
          : estimateSurvivalEvs(pokemon, set, strongest.move),
        threat: threat.species,
        move: strongest.move,
        damageRange: [
          Math.round(strongest.result.minPercent * 10) / 10,
          Math.round(strongest.result.maxPercent * 10) / 10,
        ],
        benchmarkType: "survival",
      });
    }
  }

  return benchmarks;
}

function calculateKOBenchmarks(
  pokemon: TeamPokemon,
  threats: MetaThreat[],
): Benchmark[] {
  const benchmarks: Benchmark[] = [];

  for (const threat of threats) {
    for (const set of threat.commonSets) {
      const strongest = pickOurStrongestMove(pokemon, set);
      if (!strongest) continue;

      const canOHKO = strongest.result.minPercent >= 100;
      const can2HKO = strongest.result.minPercent >= 50;

      const koText = canOHKO
        ? "OHKOs"
        : can2HKO
          ? "2HKOs"
          : `deals ${strongest.result.minPercent.toFixed(1)}-${strongest.result.maxPercent.toFixed(1)}% to`;

      benchmarks.push({
        description: `${koText} ${threat.species} with ${strongest.move}`,
        met: canOHKO || can2HKO,
        evRequired: {},
        threat: threat.species,
        move: strongest.move,
        damageRange: [
          Math.round(strongest.result.minPercent * 10) / 10,
          Math.round(strongest.result.maxPercent * 10) / 10,
        ],
        benchmarkType: "ko",
      });
    }
  }

  return benchmarks;
}

function calculateSpeedBenchmarks(
  pokemon: TeamPokemon,
  threats: MetaThreat[],
): Benchmark[] {
  const benchmarks: Benchmark[] = [];
  const mySpeed = getEffectiveSpeed(pokemon);

  for (const threat of threats) {
    for (const set of threat.commonSets) {
      const theirSpeed = getEffectiveSpeed(set);
      const outspeeds = mySpeed > theirSpeed;

      benchmarks.push({
        description: outspeeds
          ? `Outspeeds ${threat.species} (${mySpeed} vs ${theirSpeed})`
          : `Outsped by ${threat.species} (${mySpeed} vs ${theirSpeed})`,
        met: outspeeds,
        evRequired: outspeeds ? {} : estimateSpeedEvs(pokemon, theirSpeed),
        threat: threat.species,
        move: "",
        benchmarkType: "speed",
      });
    }
  }

  return benchmarks;
}

// ---------------------------------------------------------------------------
// EV estimation helpers
// ---------------------------------------------------------------------------

/**
 * Estimate what defensive EVs would be needed to survive a specific attack.
 * Returns a partial spread with just the relevant defensive stats.
 */
function estimateSurvivalEvs(
  pokemon: TeamPokemon,
  attacker: TeamPokemon,
  moveName: string,
): Partial<EVSpread> {
  // Try increasing HP and defense EVs until we survive
  const evValues = [0, 4, 36, 52, 76, 100, 116, 132, 148, 164, 180, 196, 212, 228, 244, 252];

  for (const hpEv of evValues) {
    for (const defEv of evValues) {
      if (hpEv + defEv > MAX_TOTAL_EVS) continue;

      const testPokemon: TeamPokemon = {
        ...pokemon,
        evs: { ...pokemon.evs, hp: hpEv, def: defEv },
      };

      const result = calculateDamage(attacker, testPokemon, moveName, {
        isDoubles: true,
      });
      if (result && result.maxPercent < 100) {
        return { hp: hpEv, def: defEv };
      }
    }
  }

  // Also try special defense
  for (const hpEv of evValues) {
    for (const spdEv of evValues) {
      if (hpEv + spdEv > MAX_TOTAL_EVS) continue;

      const testPokemon: TeamPokemon = {
        ...pokemon,
        evs: { ...pokemon.evs, hp: hpEv, spd: spdEv },
      };

      const result = calculateDamage(attacker, testPokemon, moveName, {
        isDoubles: true,
      });
      if (result && result.maxPercent < 100) {
        return { hp: hpEv, spd: spdEv };
      }
    }
  }

  return { hp: 252, def: 252 }; // Max investment if nothing works
}

/**
 * Estimate speed EVs needed to outspeed a target speed value.
 */
function estimateSpeedEvs(
  pokemon: TeamPokemon,
  targetSpeed: number,
): Partial<EVSpread> {
  const evValues = [0, 4, 36, 52, 76, 100, 116, 132, 148, 164, 180, 196, 212, 228, 244, 252];

  for (const speEv of evValues) {
    const testPokemon: TeamPokemon = {
      ...pokemon,
      evs: { ...pokemon.evs, spe: speEv },
    };
    const speed = getEffectiveSpeed(testPokemon);
    if (speed > targetSpeed) {
      return { spe: speEv };
    }
  }

  return { spe: 252 };
}

// ---------------------------------------------------------------------------
// Spread suggestion
// ---------------------------------------------------------------------------

/**
 * Suggest an EV spread that hits the most important benchmarks.
 * Prioritizes by meta threat usage %.
 */
function suggestSpread(
  pokemon: TeamPokemon,
  survivalBenchmarks: Benchmark[],
  koBenchmarks: Benchmark[],
  speedBenchmarks: Benchmark[],
): { spread: EVSpread; nature: string } {
  // Start with the current spread as a baseline
  const spread: EVSpread = { ...pokemon.evs };
  let nature = pokemon.nature;

  // Count failed survival benchmarks that need HP/Def/SpD
  const failedSurvivals = survivalBenchmarks.filter((b) => !b.met);
  const failedSpeed = speedBenchmarks.filter((b) => !b.met);

  // If we fail important survival checks, invest more in bulk
  if (failedSurvivals.length > 0) {
    // Check if most failed survivals need physical or special defense
    let needPhysDef = 0;
    let needSpDef = 0;

    for (const b of failedSurvivals) {
      if (b.evRequired.def !== undefined) needPhysDef++;
      if (b.evRequired.spd !== undefined) needSpDef++;
    }

    // The most important benchmark: keep max offensive stat
    const pokemonSpecies = getSpecies(pokemon.species);
    const isPhysical = pokemonSpecies
      ? pokemonSpecies.baseStats.atk >= pokemonSpecies.baseStats.spa
      : true;

    if (isPhysical) {
      spread.atk = 252;
    } else {
      spread.spa = 252;
    }

    // Invest in HP first (most efficient for bulk)
    spread.hp = 252;

    // Then allocate remaining to the more needed defense
    const remaining = MAX_TOTAL_EVS - spread.hp - (isPhysical ? spread.atk : spread.spa);
    if (needPhysDef >= needSpDef) {
      spread.def = Math.min(MAX_SINGLE_EV, remaining);
      spread.spd = Math.min(MAX_SINGLE_EV, remaining - spread.def);
    } else {
      spread.spd = Math.min(MAX_SINGLE_EV, remaining);
      spread.def = Math.min(MAX_SINGLE_EV, remaining - spread.spd);
    }
  }

  // If we fail speed checks against high-usage threats, consider speed
  if (failedSpeed.length > 0) {
    const highPrioritySpeedFail = failedSpeed.some(
      (b) => b.evRequired.spe !== undefined,
    );
    if (highPrioritySpeedFail) {
      // Find minimum speed needed
      const maxNeeded = Math.max(
        ...failedSpeed
          .map((b) => b.evRequired.spe ?? 0)
          .filter((v) => v > 0),
      );
      if (maxNeeded > 0) {
        spread.spe = Math.min(MAX_SINGLE_EV, maxNeeded);
      }
    }
  }

  // Ensure total doesn't exceed 510
  const stats: StatName[] = ["hp", "atk", "def", "spa", "spd", "spe"];
  let total = stats.reduce((sum, s) => sum + spread[s], 0);
  while (total > MAX_TOTAL_EVS) {
    // Reduce the least important stat
    for (const stat of [...stats].reverse()) {
      if (spread[stat] > 0 && total > MAX_TOTAL_EVS) {
        const reduction = Math.min(spread[stat], total - MAX_TOTAL_EVS);
        spread[stat] -= reduction;
        total -= reduction;
      }
    }
  }

  return { spread, nature };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Calculate EV benchmarks against meta threats.
 */
export function calculateBenchmarks(
  pokemon: TeamPokemon,
  metaThreats: MetaThreat[],
): BenchmarkReport {
  const survivalBenchmarks = calculateSurvivalBenchmarks(pokemon, metaThreats);
  const koBenchmarks = calculateKOBenchmarks(pokemon, metaThreats);
  const speedBenchmarks = calculateSpeedBenchmarks(pokemon, metaThreats);

  const { spread, nature } = suggestSpread(
    pokemon,
    survivalBenchmarks,
    koBenchmarks,
    speedBenchmarks,
  );

  return {
    pokemon: pokemon.species,
    survivalBenchmarks,
    koBenchmarks,
    speedBenchmarks,
    suggestedSpread: spread,
    suggestedNature: nature,
  };
}
