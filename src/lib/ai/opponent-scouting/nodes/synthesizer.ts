/**
 * Synthesizer — STUB (Phase 2).
 *
 * Phase 4 will call an LLM with the opponent_synthesizer persona to
 * produce ranked lead suggestions, watch-fors, and win conditions with
 * real matchup analysis. For now we produce a placeholder shape so the
 * UI can render something.
 */
import type { ScoutingStateType, ScoutingStateUpdate } from "../state";
import type { SuggestedLead, WinCondition } from "../types";

function mkId(prefix: string, i: number): string {
  return `${prefix}-${Date.now().toString(36)}-${i}`;
}

export async function synthesizerNode(
  state: ScoutingStateType,
): Promise<Partial<ScoutingStateUpdate>> {
  const mySpecies = state.myBrought.length > 0
    ? state.myBrought
    : state.myTeam.map((p) => p.species);

  // Single placeholder lead — first two of my brought/team if available.
  const suggestedLeads: SuggestedLead[] =
    mySpecies.length >= 2
      ? [
          {
            pair: [mySpecies[0], mySpecies[1]],
            score: 70,
            rationale:
              "Placeholder recommendation — Phase 4 will compute damage+speed calcs against predicted opponent leads.",
            gamePlan:
              "Turn 1: evaluate opponent's lead, decide on Protect / aggressive pressure based on speed tier.",
          },
        ]
      : [];

  const watchFor: string[] = [];
  if (state.archetype === "rain") watchFor.push("Pelipper/Drizzle into Swift Swim sweeper.");
  if (state.archetype === "trick room") watchFor.push("Turn 1 Trick Room setter — Fake Out / Taunt priority.");
  if (state.teamSynergies.some((s) => s.includes("Commander")))
    watchFor.push("Tatsugiri + Dondozo Commander — don't let Dondozo set up unchecked.");
  if (state.predictions.some((p) => /Kingambit/i.test(p.species)))
    watchFor.push("Kingambit Sucker Punch vs low-HP priority — avoid Intimidate drops.");
  if (watchFor.length === 0) watchFor.push("Identify the win condition Pokemon; remove it early.");

  // Agent-suggested win conditions (Phase 4 will tailor to the exact
  // matchup). Use `suggested` copy pattern so users can accept/edit.
  const now = Date.now();
  const suggestedWinConditions: WinCondition[] = [
    {
      id: mkId("wc", 0),
      label: state.archetype === "trick room"
        ? "Land Taunt on their TR setter before turn 2"
        : "Keep my primary damage dealer alive through turn 3",
      kind: state.archetype === "trick room" ? "move-landed" : "keep-alive",
      target: state.archetype === "trick room"
        ? { side: "p2", moveName: "Taunt", byTurn: 2 }
        : { side: "p1", species: mySpecies[0] ?? "" },
      status: "pending",
      checkable: true,
      source: "agent",
      createdAt: now,
    },
  ];

  const descriptionLine = state.myTeamDescription.trim().length > 0
    ? ` User's stated strategy: "${state.myTeamDescription.trim()}".`
    : "";

  const synthesis =
    `Placeholder synthesis (Phase 2 stub). Archetype detected: ${state.archetype || "unknown"}. ` +
    `Predicted ${state.predictions.length} sets.${descriptionLine} Phase 4 will produce a full-text matchup report.`;

  return {
    suggestedLeads,
    watchFor,
    suggestedWinConditions,
    synthesis,
    history: [
      {
        source: "synthesizer",
        summary: `leads=${suggestedLeads.length}, watchFor=${watchFor.length}, winConds=${suggestedWinConditions.length}`,
        at: now,
      },
    ],
  };
}
