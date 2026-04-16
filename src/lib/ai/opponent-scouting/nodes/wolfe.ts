/**
 * Wolfe Review — STUB (Phase 2).
 *
 * Phase 4 will call an LLM with the wolfe_glick persona. For now it
 * just emits a short canned note tagged with the detected archetype.
 */
import type { ScoutingStateType, ScoutingStateUpdate } from "../state";

export async function wolfeReviewNode(
  state: ScoutingStateType,
): Promise<Partial<ScoutingStateUpdate>> {
  const note =
    state.archetype === "rain"
      ? "Rain team — expect Tailwind + Swift Swim speed control. Pressure the setter early."
      : state.archetype === "trick room"
        ? "TR team — race to disrupt the setter. Fake Out + Taunt are your friends."
        : state.archetype === "sun"
          ? "Sun — watch for Growth sweepers and Protosynthesis if applicable."
          : "Balance team — identify the win condition Pokemon and remove it first.";

  return {
    wolfeNote: note,
    history: [
      {
        source: "wolfe",
        summary: note.slice(0, 80),
        at: Date.now(),
      },
    ],
  };
}
