/**
 * Set Predictor — STUB (Phase 2).
 *
 * Real implementation in Phase 3 will call an LLM with the
 * `opponent_predictor` persona and force a structured-JSON output. For
 * now, it derives a best-guess set from the Researcher's top-usage
 * Pikalytics fields — good enough to smoke-test the end-to-end flow.
 */
import { DEFAULT_EVS, DEFAULT_IVS } from "@/lib/types/pokemon";
import type { ScoutingStateType, ScoutingStateUpdate } from "../state";
import type { PredictedSet } from "../types";

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

  return {
    predictions,
    history: [
      {
        source: "predictor",
        summary: `predicted ${predictions.length} sets, avg confidence ${(
          predictions.reduce((a, p) => a + p.confidence, 0) /
          Math.max(1, predictions.length)
        ).toFixed(2)}`,
        at: Date.now(),
      },
    ],
  };
}
