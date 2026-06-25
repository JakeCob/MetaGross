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
import { matchMetaTeams, listMetaTeams } from "@/lib/meta-teams/queries";
import { getOpponentMatchups } from "@/lib/profile/build-profile";
import { isTournament } from "../modes";

const FALLBACK_FORMAT_ID = "champions-reg-m-a";

/**
 * The player's own soft matchups, from their logged history — archetypes they
 * lose to most (≥2 games, sub-50% win-rate). Personalises the critique: build
 * to cover what THIS player actually loses to, not just the global meta.
 */
async function weakMatchupsBlock(): Promise<string> {
  const matchups = await getOpponentMatchups().catch(() => []);
  const weak = matchups
    .filter((m) => m.wins + m.losses >= 2 && m.winRate < 50)
    .sort((a, b) => a.winRate - b.winRate)
    .slice(0, 4);
  if (weak.length === 0) return "";
  const list = weak
    .map((m) => `${m.archetype} (${m.wins}-${m.losses}, ${m.winRate}%)`)
    .join(", ");
  return `YOUR WEAK MATCHUPS (from this player's logged games — build to cover these): ${list}`;
}

/**
 * In TOURNAMENT mode (open team sheet), surface the proven tournament teams the
 * draft most resembles so the analyst pushes it toward a tested list rather than
 * an invented one. Falls back to the previous reg when the current one has no
 * indexed teams yet.
 */
async function provenTeamsBlock(
  species: string[],
  formatId: string,
): Promise<string> {
  let matches = await matchMetaTeams({
    species,
    format: formatId,
    minOverlap: 2,
    limit: 5,
  }).catch(() => []);
  if (matches.length === 0 && formatId !== FALLBACK_FORMAT_ID) {
    matches = await matchMetaTeams({
      species,
      format: FALLBACK_FORMAT_ID,
      minOverlap: 2,
      limit: 5,
    }).catch(() => []);
  }
  if (matches.length > 0) {
    return (
      "PROVEN TOURNAMENT TEAMS this draft resembles (open-sheet meta — adapt toward these refined lists):\n" +
      matches
        .map((m) => {
          const name = m.team.archetype ?? m.team.species.slice(0, 3).join("/");
          const also = m.missing.length
            ? `; they also run ${m.missing.slice(0, 3).join("/")}`
            : "";
          return `- ${name} (${m.team.record ?? m.team.source}, overlap ${m.overlap}/6${also})`;
        })
        .join("\n")
    );
  }
  // No overlap — show a few top proven cores as references.
  let top = await listMetaTeams(formatId, 6).catch(() => []);
  if (top.length === 0 && formatId !== FALLBACK_FORMAT_ID) {
    top = await listMetaTeams(FALLBACK_FORMAT_ID, 6).catch(() => []);
  }
  if (top.length > 0) {
    return (
      "RECENT PROVEN TOURNAMENT TEAMS (reference these open-sheet cores):\n" +
      top
        .map(
          (t) =>
            `- ${t.archetype ?? t.species.slice(0, 3).join("/")} (${t.record ?? t.source})`,
        )
        .join("\n")
    );
  }
  return "";
}

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

  const tournament = isTournament(state.mode);
  const [threatList, partners, worst, proven, weakMatchups] = await Promise.all([
    getLiveMetaThreats(format).catch(() => []),
    computePikalyticsPartners(members, format).catch(() => ""),
    computeWorstMatchups(members).catch(() => ""),
    tournament
      ? provenTeamsBlock(members.map((m) => m.species), reg.formatId)
      : Promise.resolve(""),
    weakMatchupsBlock().catch(() => ""),
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
    weakMatchups,
    proven,
  ]
    .filter(Boolean)
    .join("\n");

  const system = `${persona.systemPromptAddition} You are the Meta + Data Analyst for ${reg.label}. Using ONLY the live data provided plus the team list, judge in 3-5 sentences: which top threats does this draft struggle with, which proven Pikalytics partners is it missing, and what does its worst-matchup list reveal? Cite the specific %s/threats.${tournament ? " This is a TOURNAMENT (open team sheet) build — push the team toward the proven tournament lists shown: prefer their tested cores/sets over invented ones, and call out where the draft diverges from what's winning events." : ""} If the player's own weak matchups are listed, prioritise covering those archetypes — this build should fix what THIS player loses to. Recommend concrete data-backed swaps. Do not invent usage numbers.`;

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
