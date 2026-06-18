import type { TeamDebateStateType, TeamDebateStateUpdate } from "../state";
import { runModel, renderDraft } from "../llm";
import { AGENT_PERSONAS } from "@/lib/types/agent";
import { getRegulation } from "@/lib/data/champions";
import { getLiveMetaThreats } from "@/lib/ev/meta-enriched-lookup";
import {
  computePikalyticsPartners,
  computeWorstMatchups,
} from "@/lib/team-analysis/ai-suggestions";
import type { AITeamMember } from "@/lib/team-analysis/team-context";

/**
 * Node: the Meta + Data Analyst grounds the debate in REAL data — live
 * Pikalytics top-usage threats, Pikalytics co-usage partners for the draft,
 * and the draft's worst matchups vs recent top-cut teams (shared heuristic).
 * It reports the facts, then judges the draft against the live meta.
 */
export async function metaAnalystNode(
  state: TeamDebateStateType,
): Promise<Partial<TeamDebateStateUpdate>> {
  const { draft, format } = state;
  const reg = getRegulation(format);
  const persona = AGENT_PERSONAS.analyst;

  const members: AITeamMember[] = draft.map((m) => ({
    species: m.species,
    item: m.item,
    ability: m.ability,
    moves: m.moves,
  }));

  const [threatList, partners, worst] = await Promise.all([
    getLiveMetaThreats(format).catch(() => []),
    computePikalyticsPartners(members, format).catch(() => ""),
    computeWorstMatchups(members).catch(() => ""),
  ]);
  const threats = threatList
    .slice(0, 12)
    .map((t) => `${t.species} (${t.usagePercent}%)`)
    .join(", ");

  const dataBlock = [
    threats ? `TOP META THREATS (live Pikalytics usage): ${threats}` : "",
    partners
      ? `Pikalytics co-usage partners for this draft (summed teammate %): ${partners}`
      : "",
    worst ? `WORST matchups vs recent top-cut teams: ${worst}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system = `${persona.systemPromptAddition} You are the Meta + Data Analyst for ${reg.label}. Using ONLY the live data provided plus the team list, judge in 3-5 sentences: which top threats does this draft struggle with, which proven Pikalytics partners is it missing, and what does its worst-matchup list reveal? Cite the specific %s/threats. Recommend concrete data-backed swaps. Do not invent usage numbers.`;

  const user = [
    `Team under review:`,
    renderDraft(draft, format),
    ``,
    `LIVE DATA:`,
    dataBlock || "(no live data available right now)",
    ``,
    `Give your data-grounded critique.`,
  ].join("\n");

  const text = await runModel(system, user);
  const round = state.round;
  return {
    analystData: dataBlock,
    analystReview: text || "No meta concerns from the data.",
    transcript: [
      {
        agent: "analyst",
        label: persona.displayName,
        round,
        text: text || "No meta concerns from the data.",
      },
    ],
  };
}
