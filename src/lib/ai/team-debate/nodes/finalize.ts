import type {
  TeamDebateStateType,
  TeamDebateStateUpdate,
  DraftMember,
} from "../state";
import { runModel, parseDraftJson, renderDraft } from "../llm";
import { getRegulation } from "@/lib/data/champions";
import {
  auditTeam,
  auditLearnsets,
  withMegaAbilities,
  type AITeamMember,
} from "@/lib/team-analysis/team-context";

/** Pull the first {...} object out of a possibly fenced reply. */
function extractJsonObject(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  return start >= 0 && end > start ? t.slice(start, end + 1) : t;
}

/**
 * Node: synthesise the final team. Produces a complete, legal 6-Pokemon team
 * (full sets) plus a win-condition summary that merges the whole debate. If
 * the polished team would re-introduce a blocking violation it is rejected and
 * the debated draft is kept, so finalize can only ever improve legality.
 */
export async function finalizeNode(
  state: TeamDebateStateType,
): Promise<Partial<TeamDebateStateUpdate>> {
  const { draft, format, offenseReview, defenseReview, analystReview, critique } =
    state;
  const reg = getRegulation(format);

  const system = [
    `You are the Final Synthesizer for a ${reg.label} doubles team. Merge the debate into ONE finished team: complete every set (item, ability, 4 moves) and apply the judge's required changes. Keep it legal — only roster Pokemon, no duplicates, no contradictory speed modes, no weather-locked move without its weather, and a LEGAL held item + a real ability for each member (the post-mega ability for mega holders). Multiple mega stones are allowed (only one Mega-Evolves per battle) when they're an intentional matchup-flexibility plan sharing the same support.`,
    `BANNED ITEMS — never use these (illegal in ${reg.label}): ${reg.itemsBanned.join(", ")}.`,
    `Respond with ONLY a JSON object (no prose, no fences):`,
    `{"team":[{"species","role","item","ability","moves":["m1","m2","m3","m4"],"note"} ×6],"summary":"3-5 sentences: the win condition, how the team's speed/weather plan works, and how its shared weaknesses are covered"}`,
    `CRITICAL: the summary must describe ONLY the 6 Pokemon in your team array — never mention a Pokemon, item, or ability that isn't in the final team.`,
  ].join("\n");

  const user = [
    `Debated draft:`,
    renderDraft(draft, format),
    ``,
    `Offense coach: ${offenseReview ?? "(none)"}`,
    `Defense coach: ${defenseReview ?? "(none)"}`,
    `Data analyst: ${analystReview ?? "(none)"}`,
    `Judge's required changes: ${critique ?? "(none)"}`,
    ``,
    `Produce the final JSON object.`,
  ].join("\n");

  const text = await runModel(system, user);

  let polished: DraftMember[] | null = null;
  try {
    const obj = JSON.parse(extractJsonObject(text)) as { team?: unknown };
    if (Array.isArray(obj.team)) {
      polished = parseDraftJson(JSON.stringify(obj.team), format);
    }
  } catch {
    polished = null;
  }

  // Only accept the polished team if it's a full 6 with no blocking errors.
  const toMembers = (d: DraftMember[]): AITeamMember[] =>
    d.map((m) => ({ species: m.species, item: m.item, ability: m.ability, moves: m.moves }));

  let finalTeam = draft;
  if (polished && polished.length === 6) {
    const errs = auditTeam(toMembers(polished), format).filter(
      (v) => v.severity === "error",
    );
    if (errs.length === 0) finalTeam = polished;
  }
  // Correct each mega member's ability to its real post-mega ability
  // (Mega Mawile → Huge Power), regardless of what the LLM wrote.
  finalTeam = withMegaAbilities(finalTeam, format);

  // Summarise in a SEPARATE pass that ONLY sees the finished team — so the
  // prose can't drift onto Pokemon from an earlier draft (the model has no
  // other names in front of it).
  const summarySystem = `Write a 3-5 sentence competitive summary of EXACTLY the finished ${reg.label} doubles team below and nothing else: the win condition, the speed/weather plan, and how the team covers its shared weaknesses. Mention ONLY Pokemon that appear in the list. No preamble.`;
  const summaryUser = [
    `Final team:`,
    renderDraft(finalTeam, format),
    state.brief ? `\nUser brief: ${state.brief}` : "",
    `\nWrite the summary.`,
  ]
    .filter(Boolean)
    .join("\n");
  const summary = (await runModel(summarySystem, summaryUser)).trim();

  // Honest residual warnings on whatever we shipped.
  const residual = [
    ...auditTeam(toMembers(finalTeam), format),
    ...(await auditLearnsets(toMembers(finalTeam), format)),
  ];
  const warnNote = residual.length
    ? `\n\nRemaining notes: ${residual.map((v) => v.message).join(" ")}`
    : "";

  const finalSummary =
    (summary || "Final team synthesized from the multi-agent debate.") + warnNote;

  return {
    finalTeam,
    finalSummary,
    transcript: [
      {
        agent: "finalize",
        label: "Final Synthesizer",
        round: state.round,
        text: `Final team:\n${renderDraft(finalTeam, format)}\n\n${finalSummary}`,
      },
    ],
  };
}
