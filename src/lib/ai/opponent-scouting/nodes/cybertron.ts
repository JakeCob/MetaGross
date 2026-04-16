/**
 * Cybertron Review — STUB (Phase 2).
 *
 * Phase 4 will call an LLM with the cybertron persona. For now, canned
 * fundamentals-focused note.
 */
import type { ScoutingStateType, ScoutingStateUpdate } from "../state";

export async function cybertronReviewNode(
  state: ScoutingStateType,
): Promise<Partial<ScoutingStateUpdate>> {
  const note =
    state.archetype === "rain"
      ? "Survive turn 1: Focus Sash or Covert Cloak matter. Run bulk calcs vs the rain-boosted Water STAB."
      : state.archetype === "trick room"
        ? "Calc your bulkiest Pokemon vs the TR abusers' strongest move. A Spore or Follow Me can seal games."
        : state.archetype === "sun"
          ? "Solar Beam ignores Sun's 1-turn charge — survive the hit and OHKO the setter."
          : "Map their win condition, then identify which 2 of your 6 most reliably remove it.";

  return {
    cybertronNote: note,
    history: [
      {
        source: "cybertron",
        summary: note.slice(0, 80),
        at: Date.now(),
      },
    ],
  };
}
