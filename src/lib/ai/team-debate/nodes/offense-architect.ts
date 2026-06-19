import type { TeamDebateStateType, TeamDebateStateUpdate } from "../state";
import { runModel, renderDraft } from "../llm";
import { AGENT_PERSONAS } from "@/lib/types/agent";
import { getRegulation } from "@/lib/data/champions";

/**
 * Node: the Hyper Offense Coach critiques the draft from an OFFENSE angle —
 * win condition, speed control, breakers, tempo, and whether the team can
 * actually close games. It argues for pressure; the defense architect will
 * push back. Critique only — it does not rewrite the team.
 */
export async function offenseArchitectNode(
  state: TeamDebateStateType,
): Promise<Partial<TeamDebateStateUpdate>> {
  const { draft, format, brief } = state;
  const reg = getRegulation(format);
  const persona = AGENT_PERSONAS.aggressive_coach;

  const system = `${persona.systemPromptAddition} You are reviewing a ${reg.label} doubles team purely from the OFFENSE / win-condition angle. Be specific and critical in 3-5 sentences: Is the win condition clear and fast enough? Is speed control coherent (one mode, enough of it)? Are there real breakers and a closer, or does the team stall out? Name specific members and concrete fixes (item/move/EV/teammate). Do NOT rewrite the whole team — argue your case.`;

  const user = [
    `Team under review:`,
    renderDraft(draft, format),
    brief ? `\nUser brief: ${brief}` : "",
    `\nGive your offense critique.`,
  ]
    .filter(Boolean)
    .join("\n");

  const text = await runModel(system, user);
  const round = state.round;
  return {
    offenseReview: text || "No offense concerns.",
    transcript: [
      { agent: "offense", label: persona.displayName, round, text: text || "No offense concerns." },
    ],
  };
}
