import type { TeamDebateStateType, TeamDebateStateUpdate } from "../state";
import { runModel, renderDraft } from "../llm";
import { AGENT_PERSONAS } from "@/lib/types/agent";
import { getRegulation } from "@/lib/data/champions";
import {
  computeCoreWeaknesses,
  formatSpeedProfile,
} from "@/lib/team-analysis/team-context";

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
  const speeds = formatSpeedProfile(draft, format);

  const system = `${persona.systemPromptAddition} You are reviewing a ${reg.label} doubles team purely from the DEFENSE / resilience + STRUCTURE angle. In 3-5 sentences judge: (1) DEFENSIVE TYPE BACKBONE — do the members' types cover each other (a mutually-covering core like Fire/Water/Grass or Steel/Fairy/Dragon), or is some attacking type left uncovered? (2) Is each shared weakness RESISTED or made immune by a teammate (prefer abilities that redirect: Lightning Rod, Storm Drain, Flash Fire, Levitate)? (3) SPEED FIT — if this is a Trick Room team, are the attackers actually SLOW (low base Speed)? a fast Pokemon on TR is a structural flaw. (4) Is there Intimidate / redirection / a pivot to stabilise? Name specific members + concrete fixes. You may disagree with the offense coach. Do NOT rewrite the whole team.`;

  const user = [
    `Team under review:`,
    renderDraft(draft, format),
    speeds ? `\nBase Speeds (slowest moves first under Trick Room): ${speeds}` : "",
    weaknesses
      ? `\nComputed SHARED defensive weaknesses (type → members threatened; whether a teammate resists it):\n${weaknesses}`
      : `\n(No shared 2+ weakness detected by the type calc — still judge survivability + backbone.)`,
    offenseReview ? `\nThe offense coach argued:\n"${offenseReview}"` : "",
    `\nGive your defense + structure critique.`,
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
