/**
 * Reverse-calculate opponent EV spreads from observed damage and speed data.
 *
 * Algorithm:
 * 1. For each damage observation, try different defender EV combinations
 *    to find which produce damage in the observed range.
 * 2. For each speed observation, calculate minimum speed EVs.
 * 3. Cross-reference with meta spreads to score matches.
 * 4. Return prediction with confidence scaled by observation count.
 */

import {
  calculate,
  Pokemon,
  Move,
  Field,
  type GenerationNum,
} from "@smogon/calc";
import type {
  DamageObservation,
  SpeedObservation,
  MetaSpread,
  EVPrediction,
} from "@/lib/types/ev";
import type { EVSpread } from "@/lib/types/pokemon";
import { DEFAULT_EVS, DEFAULT_IVS } from "@/lib/types/pokemon";
import { getSpecies } from "@/lib/pokemon/species";
import { calcStat } from "@/lib/pokemon/stats";

const GEN: GenerationNum = 9;

/** Common EV values to iterate through when reverse-calcing. */
const COMMON_EV_VALUES = [
  0, 4, 36, 52, 76, 100, 116, 132, 148, 164, 180, 196, 212, 228, 244, 252,
];

/** Tolerance in damage % when matching observed damage. */
const DAMAGE_TOLERANCE = 2.5;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface EVCandidate {
  evs: Partial<EVSpread>;
  score: number;
}

interface SpeedConstraint {
  minSpe?: number;
  maxSpe?: number;
}

// ---------------------------------------------------------------------------
// Reverse damage calculation
// ---------------------------------------------------------------------------

/**
 * Given a damage observation, find which defender EV combinations
 * produce damage close to the observed %.
 */
function reverseDamageCalc(obs: DamageObservation): EVCandidate[] {
  const defenderSpecies = getSpecies(obs.defenderSpecies);
  if (!defenderSpecies) return [];

  const candidates: EVCandidate[] = [];

  // Determine if the move is physical or special to decide which defense stat matters
  let moveCategory: "physical" | "special" | null = null;
  try {
    const move = new Move(GEN, obs.moveName);
    const cat = move.category;
    if (cat === "Physical") moveCategory = "physical";
    else if (cat === "Special") moveCategory = "special";
    else return []; // Status moves don't deal damage
  } catch {
    return [];
  }

  const defStat = moveCategory === "physical" ? "def" : "spd";

  // Build attacker from observation data
  const attackerEvs = obs.attackerEvs ?? {
    ...DEFAULT_EVS,
    atk: 252,
    spe: 252,
    hp: 4,
  };
  const attackerNature = obs.attackerNature ?? "Adamant";

  // Try different HP + defense stat EV combinations
  for (const hpEv of COMMON_EV_VALUES) {
    for (const defEv of COMMON_EV_VALUES) {
      // Quick check: total can't exceed 510 with just these two
      if (hpEv + defEv > 510) continue;

      try {
        const atkPokemon = new Pokemon(GEN, obs.attackerSpecies, {
          level: 50,
          ability: obs.attackerAbility,
          item: obs.attackerItem,
          nature: attackerNature,
          evs: attackerEvs,
          ivs: { ...DEFAULT_IVS },
        });

        const defEvs = { ...DEFAULT_EVS, hp: hpEv, [defStat]: defEv };
        const defPokemon = new Pokemon(GEN, obs.defenderSpecies, {
          level: 50,
          nature: "Hardy", // Try neutral first
          evs: defEvs,
          ivs: { ...DEFAULT_IVS },
        });

        const move = new Move(GEN, obs.moveName);

        const fieldOptions: ConstructorParameters<typeof Field>[0] = {
          gameType: "Doubles",
        };
        if (obs.fieldWeather) {
          const weatherMap: Record<string, "Sun" | "Rain" | "Sand" | "Snow"> = {
            sun: "Sun",
            rain: "Rain",
            sand: "Sand",
            snow: "Snow",
          };
          fieldOptions.weather = weatherMap[obs.fieldWeather];
        }
        if (obs.fieldTerrain) {
          const terrainMap: Record<
            string,
            "Electric" | "Grassy" | "Misty" | "Psychic"
          > = {
            electric: "Electric",
            grassy: "Grassy",
            misty: "Misty",
            psychic: "Psychic",
          };
          fieldOptions.terrain = terrainMap[obs.fieldTerrain];
        }

        const field = new Field(fieldOptions);
        const result = calculate(GEN, atkPokemon, defPokemon, move, field);

        const [minDmg, maxDmg] = result.range();
        const defHP = defPokemon.maxHP();
        const minPercent = (minDmg / defHP) * 100;
        const maxPercent = (maxDmg / defHP) * 100;

        // Check if observed damage falls within the calculated range (with tolerance)
        const obsLow = obs.damagePercent - DAMAGE_TOLERANCE;
        const obsHigh = obs.damagePercent + DAMAGE_TOLERANCE;

        // The observed damage should overlap with the calc'd range
        if (maxPercent >= obsLow && minPercent <= obsHigh) {
          // Score: how close is the midpoint of the calc to the observed?
          const calcMid = (minPercent + maxPercent) / 2;
          const diff = Math.abs(calcMid - obs.damagePercent);
          const score = Math.max(0, 1 - diff / 10);

          candidates.push({
            evs: { hp: hpEv, [defStat]: defEv },
            score,
          });
        }
      } catch {
        // Skip invalid combinations
        continue;
      }
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Speed analysis
// ---------------------------------------------------------------------------

/**
 * From a speed observation, derive constraints on one Pokemon's speed EVs.
 * We predict the speed EVs for pokemonA.
 */
function analyzeSpeed(obs: SpeedObservation): SpeedConstraint {
  const speciesA = getSpecies(obs.pokemonA);
  const speciesB = getSpecies(obs.pokemonB);
  if (!speciesA || !speciesB) return {};

  const trickRoom = obs.fieldState?.trickRoom ?? false;

  // If A moved first in normal conditions → A is faster → high speed EVs
  // If A moved first in Trick Room → A is slower → low speed EVs
  const aIsFaster = obs.aMovedFirst !== trickRoom; // XOR

  if (aIsFaster) {
    // A outsped B: A needs enough speed EVs to beat B's base speed range
    // Assume B has a common speed tier (could be 0 Spe or 252 Spe)
    // We'll estimate that A needs at least moderate speed investment
    const bBaseSpeed = speciesB.baseStats.spe;
    const aBaseSpeed = speciesA.baseStats.spe;

    if (aBaseSpeed >= bBaseSpeed) {
      // A has naturally higher base speed, may not need much investment
      // but still needs some to be safe
      return { minSpe: 100 };
    } else {
      // A has lower base speed but still outsped → heavy investment
      return { minSpe: 200 };
    }
  } else {
    // A is slower than B
    return { maxSpe: 100 };
  }
}

// ---------------------------------------------------------------------------
// Meta spread scoring
// ---------------------------------------------------------------------------

/**
 * Score a meta spread based on how well it matches the observations.
 */
function scoreMetaSpread(
  spread: MetaSpread,
  damageCandidates: EVCandidate[],
  speedConstraints: SpeedConstraint[],
): number {
  let score = 0;
  let factors = 0;

  // Score against damage candidates: does the spread's EVs match any candidate?
  for (const candidate of damageCandidates) {
    factors++;
    let match = true;
    let proximity = 0;

    for (const [stat, value] of Object.entries(candidate.evs)) {
      const spreadVal = spread.evs[stat as keyof EVSpread] ?? 0;
      const diff = Math.abs(spreadVal - (value as number));
      if (diff > 32) {
        match = false;
      }
      proximity += Math.max(0, 1 - diff / 252);
    }

    if (match) {
      score += candidate.score * 0.5 + proximity * 0.5;
    }
  }

  // Score against speed constraints
  for (const constraint of speedConstraints) {
    factors++;
    const spreadSpe = spread.evs.spe ?? 0;

    if (constraint.minSpe !== undefined && spreadSpe >= constraint.minSpe) {
      score += 1;
    } else if (
      constraint.maxSpe !== undefined &&
      spreadSpe <= constraint.maxSpe
    ) {
      score += 1;
    } else if (constraint.minSpe !== undefined || constraint.maxSpe !== undefined) {
      // Partial credit based on proximity
      if (constraint.minSpe !== undefined) {
        score += Math.max(0, 1 - Math.abs(spreadSpe - constraint.minSpe) / 252);
      }
      if (constraint.maxSpe !== undefined) {
        score += Math.max(0, 1 - Math.abs(spreadSpe - constraint.maxSpe) / 252);
      }
    }
  }

  // Usage popularity as a prior
  score += spread.usagePercent / 100;

  return factors > 0 ? score / (factors + 1) : spread.usagePercent / 100;
}

// ---------------------------------------------------------------------------
// Main prediction function
// ---------------------------------------------------------------------------

/**
 * Predict an opponent Pokemon's EV spread based on observed damage and speed data.
 */
export function predictEVs(
  observations: DamageObservation[],
  speedObservations: SpeedObservation[],
  metaSpreads: MetaSpread[],
): EVPrediction {
  const totalObservations = observations.length + speedObservations.length;

  // Collect damage candidates from all observations
  const allDamageCandidates: EVCandidate[] = [];
  for (const obs of observations) {
    const candidates = reverseDamageCalc(obs);
    allDamageCandidates.push(...candidates);
  }

  // Collect speed constraints
  const speedConstraints: SpeedConstraint[] = [];
  for (const obs of speedObservations) {
    const constraint = analyzeSpeed(obs);
    speedConstraints.push(constraint);
  }

  // Score meta spreads
  const scoredSpreads = metaSpreads
    .map((spread) => ({
      spread,
      score: scoreMetaSpread(spread, allDamageCandidates, speedConstraints),
    }))
    .sort((a, b) => b.score - a.score);

  // Build predicted EVs from best candidates or meta spread
  let predictedEvs: Partial<EVSpread> = {};
  let predictedNature = "Hardy";

  if (scoredSpreads.length > 0 && scoredSpreads[0].score > 0) {
    const bestSpread = scoredSpreads[0].spread;
    predictedEvs = { ...bestSpread.evs };
    predictedNature = bestSpread.nature;
  } else {
    // Fallback: aggregate from damage candidates and speed constraints
    predictedEvs = aggregateCandidates(allDamageCandidates, speedConstraints);
    predictedNature = inferNature(predictedEvs);
  }

  // Apply speed constraints to predicted EVs
  for (const constraint of speedConstraints) {
    if (constraint.minSpe !== undefined) {
      const currentSpe = predictedEvs.spe ?? 0;
      if (currentSpe < constraint.minSpe) {
        predictedEvs.spe = constraint.minSpe;
      }
    }
    if (constraint.maxSpe !== undefined) {
      const currentSpe = predictedEvs.spe ?? 252;
      if (currentSpe > constraint.maxSpe) {
        predictedEvs.spe = constraint.maxSpe;
      }
    }
  }

  // Calculate confidence based on observation count
  let confidence: number;
  if (totalObservations === 0) {
    confidence = 10;
  } else if (totalObservations === 1) {
    confidence = 20 + Math.round(Math.random() * 20); // 20-40
  } else if (totalObservations === 2) {
    confidence = 40 + Math.round(Math.random() * 20); // 40-60
  } else {
    confidence = 60 + Math.min(30, totalObservations * 8); // 60-90
  }

  // Boost confidence if meta spread matched well
  if (scoredSpreads.length > 0 && scoredSpreads[0].score > 0.5) {
    confidence = Math.min(90, confidence + 10);
  }

  return {
    predictedEvs,
    predictedNature,
    confidence,
    matchedSpread:
      scoredSpreads.length > 0 && scoredSpreads[0].score > 0
        ? scoredSpreads[0].spread
        : undefined,
    possibleSpreads: scoredSpreads.map((s) => s.spread),
    observations: totalObservations,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Aggregate EV candidates into a single best-guess spread.
 */
function aggregateCandidates(
  candidates: EVCandidate[],
  speedConstraints: SpeedConstraint[],
): Partial<EVSpread> {
  if (candidates.length === 0 && speedConstraints.length === 0) {
    return { hp: 252, atk: 252, spe: 4 }; // Default offensive guess
  }

  const statTotals: Record<string, { sum: number; count: number }> = {};

  for (const candidate of candidates) {
    for (const [stat, value] of Object.entries(candidate.evs)) {
      if (!statTotals[stat]) {
        statTotals[stat] = { sum: 0, count: 0 };
      }
      statTotals[stat].sum += (value as number) * candidate.score;
      statTotals[stat].count += candidate.score;
    }
  }

  const result: Partial<EVSpread> = {};
  for (const [stat, totals] of Object.entries(statTotals)) {
    if (totals.count > 0) {
      // Round to nearest common EV value
      const avg = totals.sum / totals.count;
      const nearest = COMMON_EV_VALUES.reduce((prev, curr) =>
        Math.abs(curr - avg) < Math.abs(prev - avg) ? curr : prev,
      );
      (result as Record<string, number>)[stat] = nearest;
    }
  }

  // Apply speed constraints
  for (const constraint of speedConstraints) {
    if (constraint.minSpe !== undefined) {
      result.spe = Math.max(result.spe ?? 0, constraint.minSpe);
    }
    if (constraint.maxSpe !== undefined) {
      result.spe = Math.min(result.spe ?? 252, constraint.maxSpe);
    }
  }

  return result;
}

/**
 * Infer a likely nature from predicted EVs.
 */
function inferNature(evs: Partial<EVSpread>): string {
  // Find the highest-invested stat (excluding HP)
  const stats: { stat: string; val: number }[] = [
    { stat: "atk", val: evs.atk ?? 0 },
    { stat: "def", val: evs.def ?? 0 },
    { stat: "spa", val: evs.spa ?? 0 },
    { stat: "spd", val: evs.spd ?? 0 },
    { stat: "spe", val: evs.spe ?? 0 },
  ];

  stats.sort((a, b) => b.val - a.val);
  const highest = stats[0].stat;
  const lowest = stats[stats.length - 1].stat;

  // Nature boosts the highest-invested stat, lowers the least-invested
  const natureMap: Record<string, Record<string, string>> = {
    atk: { spa: "Adamant", spe: "Brave", def: "Lonely", spd: "Naughty" },
    def: { atk: "Bold", spa: "Impish", spe: "Relaxed", spd: "Lax" },
    spa: { atk: "Modest", def: "Mild", spe: "Quiet", spd: "Rash" },
    spd: { atk: "Calm", def: "Gentle", spa: "Careful", spe: "Sassy" },
    spe: { atk: "Timid", def: "Hasty", spa: "Jolly", spd: "Naive" },
  };

  if (highest === lowest || !natureMap[highest]) return "Hardy";
  return natureMap[highest][lowest] ?? "Hardy";
}
