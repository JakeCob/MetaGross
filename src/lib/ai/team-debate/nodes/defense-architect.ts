import type { TeamDebateStateType, TeamDebateStateUpdate } from "../state";
import { runModel, renderDraft } from "../llm";
import { AGENT_PERSONAS } from "@/lib/types/agent";
import { getRegulation } from "@/lib/data/champions";
import { computeCoreWeaknesses } from "@/lib/team-analysis/team-context";

/**
 * Node: the Bulk & Control Coach critiques the draft from a DEFENSE angle —
 * the team's shared type weaknesses (computed deterministically and handed to
 * it), bulky pivots, redirection/protection, and longevity. It pushes back on
 * the offense coach when the team is too fragile. Critique only.
 */
export async function defenseArchitectNode(
  state: TeamDebateStateType,
): Promise<Partial<TeamDebateStateUpdate>> {
  const { draft, format, offenseReview } = state;
  const reg = getRegulation(format);
  const persona = AGENT_PERSONAS.defensive_coach;
  const weaknesses = computeCoreWeaknesses(draft, format);

  const system = `${persona.systemPromptAddition} You are reviewing a ${reg.label} doubles team purely from the DEFENSE / resilience angle. In 3-5 sentences: does the team survive the meta's spread damage and key attackers? Are its SHARED type weaknesses covered — ideally by an ability immunity that REDIRECTS (Lightning Rod, Storm Drain, Flash Fire, Levitate), not just a resist? Is there Intimidate / redirection / a defensive pivot to stabilise? Name specific members and concrete fixes. You may disagree with the offense coach. Do NOT rewrite the whole team.`;

  const user = [
    `Team under review:`,
    renderDraft(draft, format),
    weaknesses
      ? `\nComputed SHARED defensive weaknesses (attacking type → members it threatens):\n${weaknesses}`
      : `\n(No shared 2+ weakness detected by the type calc — still judge survivability.)`,
    offenseReview ? `\nThe offense coach argued:\n"${offenseReview}"` : "",
    `\nGive your defense critique.`,
  ]
    .filter(Boolean)
    .join("\n");

  const text = await runModel(system, user);
  const round = state.round;
  return {
    defenseReview: text || "No defense concerns.",
    transcript: [
      { agent: "defense", label: persona.displayName, round, text: text || "No defense concerns." },
    ],
  };
}
