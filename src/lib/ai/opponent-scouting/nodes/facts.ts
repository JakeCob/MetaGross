/**
 * Mechanical Facts node — pure compute, no LLM.
 *
 * Runs after the predictor so opponent sets are in state, and before
 * the synthesizer so facts can be injected into the prompt.
 */
import {
  computeMechanicalFacts,
  type MechanicalFacts,
} from "../mechanical-facts";
import type { ScoutingStateType, ScoutingStateUpdate } from "../state";

export async function factsNode(
  state: ScoutingStateType,
): Promise<Partial<ScoutingStateUpdate>> {
  const facts: MechanicalFacts = computeMechanicalFacts(
    state.myTeam,
    state.predictions,
  );

  const summary = [
    `megaSwaps=${facts.megaAbilitySwaps.length}`,
    `fakeOutImmune=${facts.fakeOutImmunities.length}`,
    `4xWeak=${facts.fourXWeaknesses.length}`,
    `weather=${facts.weatherSetters.length}`,
    `intimidateHits=${facts.intimidateInteractions.length}`,
  ].join(", ");

  return {
    mechanicalFacts: facts,
    history: [
      {
        source: "facts",
        summary,
        at: Date.now(),
      },
    ],
  };
}
