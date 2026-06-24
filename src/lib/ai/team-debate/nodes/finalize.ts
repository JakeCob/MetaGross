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
import { optimizeEVSpread } from "@/lib/ai/ev-debate";
import type { TeamPokemon } from "@/lib/types/pokemon";

const FLAT_IVS = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
const ZERO_EVS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

/** Build a TeamPokemon (the EV optimizer's input shape) from a draft member. */
function draftToTeamPokemon(m: DraftMember): TeamPokemon {
  return {
    species: m.species,
    ability: m.ability ?? "",
    item: m.item ?? "",
    nature: m.nature ?? "Hardy",
    level: 50,
    moves: [
      m.moves?.[0] ?? "",
      m.moves?.[1] ?? "",
      m.moves?.[2] ?? "",
      m.moves?.[3] ?? "",
    ],
    evs: m.evs ?? ZERO_EVS,
    ivs: FLAT_IVS,
  };
}

/** Optimize one member's EVs, retrying once on a transient failure (rate
 *  limit / abort). Falls back to the un-optimized member if both attempts fail. */
async function optimizeOne(
  m: DraftMember,
  others: TeamPokemon[],
  format: string,
): Promise<DraftMember> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await optimizeEVSpread(draftToTeamPokemon(m), others, format);
      return { ...m, nature: res.nature, evs: res.spread };
    } catch {
      // retry once, then give up and keep the member as-is
    }
  }
  return m;
}

/**
 * Run the full multi-agent EV optimizer on every member, merging the
 * benchmarked spread + nature back onto each draft member. Heavy (6× the EV
 * debate) — that's the intended trade-off — but capped at EV_CONCURRENCY at a
 * time so 6 simultaneous debates (~30 LLM calls) don't stampede provider rate
 * limits (which earlier left half the team un-optimized). Per-member failures
 * fall back to the un-optimized member so one bad run can't sink the team.
 */
const EV_CONCURRENCY = 2;
async function optimizeTeamEVs(
  team: DraftMember[],
  format: string,
): Promise<DraftMember[]> {
  const out = [...team];
  for (let start = 0; start < team.length; start += EV_CONCURRENCY) {
    const end = Math.min(start + EV_CONCURRENCY, team.length);
    const batch: Promise<void>[] = [];
    for (let i = start; i < end; i++) {
      const others = team.filter((_, j) => j !== i).map(draftToTeamPokemon);
      batch.push(
        optimizeOne(team[i], others, format).then((r) => {
          out[i] = r;
        }),
      );
    }
    await Promise.all(batch);
  }
  return out;
}

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

  // Benchmark-optimize every member's EVs + nature so the team ships
  // battle-ready (the full EV debate, run on all 6 in parallel).
  finalTeam = await optimizeTeamEVs(finalTeam, format);

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
