import type { TeamDebateStateType, TeamDebateStateUpdate } from "../state";
import { runModel, renderDraft } from "../llm";
import { getRegulation } from "@/lib/data/champions";
import {
  auditTeam,
  auditLearnsets,
  type AITeamMember,
} from "@/lib/team-analysis/team-context";

/**
 * Node: the Critic / Judge. It runs the DETERMINISTIC auditor (the reliable
 * backbone — illegal picks, two megas, weather traps, speed-mode clashes,
 * open weaknesses) and then synthesises the three persona reviews + those
 * violations into a prioritised list of required changes. The deterministic
 * audit — not the LLM — decides whether the loop revises again, so the debate
 * always terminates.
 */
export async function criticJudgeNode(
  state: TeamDebateStateType,
): Promise<Partial<TeamDebateStateUpdate>> {
  const { draft, format, offenseReview, defenseReview, analystReview } = state;
  const reg = getRegulation(format);

  const members: AITeamMember[] = draft.map((m) => ({
    species: m.species,
    item: m.item,
    ability: m.ability,
    moves: m.moves,
  }));
  const violations = [
    ...auditTeam(members, format),
    ...(await auditLearnsets(members, format)),
  ];
  const errors = violations.filter((v) => v.severity === "error");

  const violationBlock = violations.length
    ? violations.map((v) => `- [${v.severity}] (${v.rule}) ${v.message}`).join("\n")
    : "- none";

  const system = `You are the Head Judge for ${reg.label} team building. You receive three expert reviews (offense, defense, data) plus a DETERMINISTIC rules audit. Produce a short, prioritised list of REQUIRED CHANGES the architect must make next — merge overlapping points, resolve disagreements, and put the hard rule violations first. Be concrete (name the member + the fix). End with a one-line VERDICT: "PASS" if there are no blocking issues, else "REVISE". 6-10 lines max.`;

  const user = [
    `Team:`,
    renderDraft(draft, format),
    ``,
    `DETERMINISTIC RULES AUDIT:`,
    violationBlock,
    ``,
    `OFFENSE COACH: ${offenseReview ?? "(none)"}`,
    ``,
    `DEFENSE COACH: ${defenseReview ?? "(none)"}`,
    ``,
    `DATA ANALYST: ${analystReview ?? "(none)"}`,
    ``,
    `Write the required-changes list and the VERDICT.`,
  ].join("\n");

  const text = await runModel(system, user);
  const round = state.round;

  // Deterministic verdict drives the loop; the LLM text guides the fix.
  const verdictLine = errors.length
    ? `VERDICT: REVISE (${errors.length} blocking rule violation${errors.length === 1 ? "" : "s"})`
    : `VERDICT: PASS (no blocking rule violations)`;

  return {
    violations,
    critique: text || verdictLine,
    transcript: [
      {
        agent: "critic",
        label: "Head Judge",
        round,
        text: `${text || "(no synthesis)"}\n\n[deterministic] ${verdictLine}`,
      },
    ],
  };
}
