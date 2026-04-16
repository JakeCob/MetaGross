/**
 * Set Predictor — Phase 2 stub + Phase-4-ready EV refinement.
 *
 * Derives a best-guess set per opponent species from the Researcher's
 * top-usage Pikalytics data. When mid-battle speed and damage
 * observations are available, calls the reverse-calc engine
 * (`predictEVs`) to sharpen EV and nature predictions.
 */
import { DEFAULT_EVS, DEFAULT_IVS } from "@/lib/types/pokemon";
import type { ScoutingStateType, ScoutingStateUpdate } from "../state";
import type { PredictedSet } from "../types";
import { predictEVs } from "@/lib/ev/reverse-calc";
import { getMetaSpreads } from "@/lib/ev/meta-lookup";

function top<T extends { name: string; usage: number }>(
  list: T[] | undefined,
  fallback: string,
): string {
  return list && list.length > 0 ? list[0].name : fallback;
}

export async function predictorNode(
  state: ScoutingStateType,
): Promise<Partial<ScoutingStateUpdate>> {
  const isChampions = state.format.toLowerCase().startsWith("champions");
  const scale: PredictedSet["scale"] = isChampions ? "champions" : "traditional";

  const predictions: PredictedSet[] = state.opponentTeam.map((p) => {
    const species = p.species ?? "";
    const finding = state.research.find((r) => r.species === species);

    // Revealed fields take precedence over guesses; otherwise fall back
    // to top Pikalytics entries; otherwise sentinel defaults.
    const ability =
      p.ability && p.ability.trim().length > 0
        ? p.ability
        : top(finding?.pikalyticsAbilities, "");
    const item =
      p.item && p.item.trim().length > 0
        ? p.item
        : top(finding?.pikalyticsItems, "");
    const topMoves = (finding?.pikalyticsMoves ?? [])
      .slice(0, 4)
      .map((m) => m.name);
    while (topMoves.length < 4) topMoves.push("");
    const moves = [
      topMoves[0] ?? "",
      topMoves[1] ?? "",
      topMoves[2] ?? "",
      topMoves[3] ?? "",
    ] as [string, string, string, string];

    const revealedCount =
      (p.ability ? 1 : 0) + (p.item ? 1 : 0);
    const confidence = Math.min(
      0.95,
      0.35 + revealedCount * 0.2 + (finding && !finding.degraded ? 0.2 : 0),
    );

    const rationaleParts: string[] = [];
    if (p.ability) rationaleParts.push(`ability confirmed (${p.ability})`);
    else if (finding?.pikalyticsAbilities?.[0])
      rationaleParts.push(
        `ability guess: ${finding.pikalyticsAbilities[0].name} (${finding.pikalyticsAbilities[0].usage}% usage)`,
      );
    if (p.item) rationaleParts.push(`item confirmed (${p.item})`);
    else if (finding?.pikalyticsItems?.[0])
      rationaleParts.push(
        `item guess: ${finding.pikalyticsItems[0].name} (${finding.pikalyticsItems[0].usage}% usage)`,
      );
    if (finding?.degraded) rationaleParts.push("data degraded");

    return {
      species,
      ability,
      item,
      moves,
      nature: "Hardy",
      level: 50,
      evs: { ...DEFAULT_EVS },
      ivs: { ...DEFAULT_IVS },
      scale,
      confidence,
      rationale: rationaleParts.join("; ") || "Best-guess defaults.",
    } satisfies PredictedSet;
  });

  // --- Refine with mid-battle observations (speed + damage) ---
  const hasObs =
    state.speedObservations.length > 0 || state.damageObservations.length > 0;

  if (hasObs) {
    for (const pred of predictions) {
      // Filter observations relevant to this species.
      const speedObs = state.speedObservations.filter(
        (o) => o.pokemonA === pred.species,
      );
      const damageObs = state.damageObservations.filter(
        (o) =>
          o.defenderSpecies === pred.species ||
          o.attackerSpecies === pred.species,
      );

      if (speedObs.length === 0 && damageObs.length === 0) continue;

      const metaSpreads = getMetaSpreads(pred.species, state.format);
      const evPrediction = predictEVs(damageObs, speedObs, metaSpreads);

      if (evPrediction.confidence > 20) {
        // Merge the reverse-calc results into the prediction. Higher
        // confidence observations override meta defaults.
        if (evPrediction.predictedEvs.spe !== undefined) {
          pred.evs.spe = evPrediction.predictedEvs.spe;
        }
        if (evPrediction.predictedEvs.hp !== undefined) {
          pred.evs.hp = evPrediction.predictedEvs.hp;
        }
        if (evPrediction.predictedEvs.def !== undefined) {
          pred.evs.def = evPrediction.predictedEvs.def;
        }
        if (evPrediction.predictedEvs.spd !== undefined) {
          pred.evs.spd = evPrediction.predictedEvs.spd;
        }
        if (evPrediction.predictedEvs.atk !== undefined) {
          pred.evs.atk = evPrediction.predictedEvs.atk;
        }
        if (evPrediction.predictedEvs.spa !== undefined) {
          pred.evs.spa = evPrediction.predictedEvs.spa;
        }
        if (evPrediction.predictedNature !== "Hardy") {
          pred.nature = evPrediction.predictedNature;
        }
        pred.confidence = Math.min(
          0.95,
          pred.confidence + evPrediction.confidence / 200,
        );
        pred.rationale += ` | reverse-calc (${speedObs.length} speed + ${damageObs.length} damage obs): nature=${evPrediction.predictedNature}, conf=${evPrediction.confidence}%`;
      }
    }
  }

  return {
    predictions,
    history: [
      {
        source: "predictor",
        summary: `predicted ${predictions.length} sets${hasObs ? ` (refined with ${state.speedObservations.length} speed + ${state.damageObservations.length} damage obs)` : ""}, avg confidence ${(
          predictions.reduce((a, p) => a + p.confidence, 0) /
          Math.max(1, predictions.length)
        ).toFixed(2)}`,
        at: Date.now(),
      },
    ],
  };
}
