import type { EVDebateStateType, EVDebateStateUpdate } from "../state";
import type { SimulationResult } from "../state";
import { calculateDamage } from "@/lib/engine/damage-calc";
import { getEffectiveSpeed } from "@/lib/engine/speed-calc";
import { getMetaThreats } from "@/lib/ev/meta-lookup";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { CHAMPIONS_POINTS } from "@/lib/data/champions";

/**
 * Run the benchmark simulation for a given Pokemon+spread combination.
 * Pure calculation, no LLM.
 */
function runBenchmarks(
  testPokemon: TeamPokemon,
  format: string,
): SimulationResult[] {
  const threats = getMetaThreats(format).slice(0, 10);
  const results: SimulationResult[] = [];

  for (const threat of threats) {
    for (const threatSet of threat.commonSets) {
      // --- Defensive check: can we survive their strongest move? ---
      let worstDmgPercent = 0;
      let worstMove = "";

      for (const moveName of threatSet.moves) {
        if (!moveName) continue;
        const dmg = calculateDamage(threatSet, testPokemon, moveName, {
          isDoubles: true,
        });
        if (dmg && dmg.maxPercent > worstDmgPercent) {
          worstDmgPercent = dmg.maxPercent;
          worstMove = moveName;
        }
      }

      // --- Offensive check: can we KO them? ---
      let bestOurDmg = 0;
      let bestOurMove = "";

      for (const moveName of testPokemon.moves) {
        if (!moveName) continue;
        const dmg = calculateDamage(testPokemon, threatSet, moveName, {
          isDoubles: true,
        });
        if (dmg && dmg.maxPercent > bestOurDmg) {
          bestOurDmg = dmg.maxPercent;
          bestOurMove = moveName;
        }
      }

      // --- Speed comparison ---
      const ourSpeed = getEffectiveSpeed(testPokemon);
      const theirSpeed = getEffectiveSpeed(threatSet);
      const speedCmp =
        ourSpeed > theirSpeed
          ? `Outspeeds (${ourSpeed} vs ${theirSpeed})`
          : ourSpeed === theirSpeed
            ? `Speed tie (${ourSpeed})`
            : `Outsped (${ourSpeed} vs ${theirSpeed})`;

      const survives = worstDmgPercent < 100;
      const dmgRange = worstMove
        ? `${worstMove}: ${worstDmgPercent.toFixed(1)}%`
        : "No damage data";
      const koPart = bestOurMove
        ? ` | Our ${bestOurMove}: ${bestOurDmg.toFixed(1)}%`
        : "";

      results.push({
        threat: threat.species,
        survives,
        damageRange: `${dmgRange}${koPart}`,
        speedComparison: speedCmp,
      });
    }
  }
  return results;
}

function buildTestPokemon(state: EVDebateStateType): TeamPokemon {
  const { pokemon, currentSpread, currentNature, currentMoves, currentAbility, currentItem, format } = state;
  const isChampions = format.toLowerCase().startsWith("champions");
  const moves = (currentMoves.length === 4
    ? currentMoves
    : [...currentMoves, "", "", "", ""].slice(0, 4)) as [string, string, string, string];
  return {
    ...pokemon,
    ability: currentAbility || pokemon.ability,
    item: currentItem || pokemon.item,
    moves,
    evs: isChampions
      ? {
          hp: currentSpread.hp * CHAMPIONS_POINTS.evConversion,
          atk: currentSpread.atk * CHAMPIONS_POINTS.evConversion,
          def: currentSpread.def * CHAMPIONS_POINTS.evConversion,
          spa: currentSpread.spa * CHAMPIONS_POINTS.evConversion,
          spd: currentSpread.spd * CHAMPIONS_POINTS.evConversion,
          spe: currentSpread.spe * CHAMPIONS_POINTS.evConversion,
        }
      : currentSpread,
    nature: currentNature,
  };
}

/**
 * Initial simulation — runs BEFORE propose. Uses the user's set as-is so
 * the proposal node can see what specifically fails under the current
 * configuration and optimize accordingly.
 */
export async function simulateInitialNode(
  state: EVDebateStateType,
): Promise<Partial<EVDebateStateUpdate>> {
  const testPokemon = buildTestPokemon(state);
  const results = runBenchmarks(testPokemon, state.format);
  // Populate BOTH so the propose node always has something to diff against.
  return { initialSimulationResults: results, simulationResults: results };
}

/**
 * Final simulation — runs AFTER the personas have agreed. Benchmarks the
 * proposed set against the meta threats; results feed the finalize node
 * and any looping logic.
 */
export async function simulateNode(
  state: EVDebateStateType,
): Promise<Partial<EVDebateStateUpdate>> {
  const testPokemon = buildTestPokemon(state);
  const results = runBenchmarks(testPokemon, state.format);
  return { simulationResults: results };
}
