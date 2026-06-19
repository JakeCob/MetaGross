/**
 * AI-powered "build around my team" suggester.
 *
 * Unlike the heuristic engine in ./suggestions.ts (Pikalytics co-usage +
 * type coverage + roles), this asks an LLM to reason about INTERNAL synergy
 * (abilities/immunities/win-conditions), coverage gaps, AND meta matchups
 * (weather, Trick Room, prominent megas). Constrained to the legal roster
 * and gracefully unavailable when no API key is configured.
 *
 * Server-only — imports the AI client + @pkmn-backed champions data.
 */
import "server-only";

import { aiComplete, isAIAvailable } from "@/lib/ai/client";
import {
  getRegulation,
  isChampionsPokemon,
  isConfirmedNotInChampions,
} from "@/lib/data/champions";
import { getLiveMetaThreats } from "@/lib/ev/meta-enriched-lookup";
import {
  getPikalyticsPokemonDetail,
  resolvePikalyticsFormat,
} from "@/lib/pokemon/pikalytics";
import { scoreTeamVsTopTeams } from "./matchup-heuristic";
import {
  type AITeamMember,
  describeMember,
  computeCoreWeaknesses,
  detectSpeedDirective,
  detectWeatherDirective,
} from "./team-context";
import type { TeamSuggestion } from "./suggestions";

export type { AITeamMember };

const VALID_CATEGORIES = new Set<TeamSuggestion["category"]>([
  "coverage",
  "synergy",
  "role",
  "meta",
]);

function buildSystemPrompt(format: string): string {
  const reg = getRegulation(format);
  return [
    `You are a VGC doubles team-building expert for Pokemon ${reg.label}.`,
    `Format: Doubles, bring 6 pick 4, level 50, Mega Evolution ON, NO Terastallization, IVs fixed at 31, ${reg.points.totalMax}-point stat system (max ${reg.points.perStatMax}/stat).`,
    ``,
    `Your job: complete a partial team into a COHESIVE unit. Think about SYNERGY first — how the pieces work together — not just a checklist of roles.`,
    ``,
    `STEP 1 — READ THE TEAM (reason this out before suggesting):`,
    `  • Win condition / game plan — what is this team actually trying to do to win? (e.g. "rain hyper-offense: Pelipper sets rain + Tailwind, fast attackers clean"; "Trick Room: slow breakers swing first"; "Intimidate balance: chip + pivot, grind the long game".)`,
    `  • Existing synergies — ability combos, weather/terrain enabling sweepers, the speed mode (Tailwind vs Trick Room), redirection, pivoting, defensive type cores already present.`,
    `  • Synergy GAPS — what does that win condition still need to actually function and not fall apart?`,
    ``,
    `STEP 2 — Suggest teammates that ACTIVELY ADVANCE that win condition. Every pick must do at least one concrete thing FOR a specific current member, e.g.: set the weather/terrain/Tailwind/Trick Room the core wants; redirect (Rage Powder / Follow Me) so a setup sweeper or frail attacker survives; pivot it in safely (U-turn / Volt Switch / Parting Shot); enable it with Helping Hand / screens / Intimidate / Fake Out; or cover a teammate's specific weakness / answer a threat the core loses to. Prefer real ability + move synergies over generically-strong mons.`,
    ``,
    `SYNERGY PATTERNS to look for: weather setter ↔ its abusers; the speed mode (Tailwind OR Trick Room) ↔ the attackers built for it; redirection ↔ a setup/fragile sweeper; Intimidate / screens / Will-O-Wisp ↔ a bulky win-con; Fake Out + spread damage ↔ securing KO ranges; pivot moves ↔ bringing a breaker in for free; Fighting ↔ Ghost/Fairy defensive partners; Contrary / Stamina snowballers ↔ the support that buys them a turn.`,
    `Also cover meta matchups — the team must answer common ${reg.label} archetypes (rain/sun/sand/snow, Trick Room, Tailwind HO, redirection) and prominent megas (Mega Metagross, Mega Mawile, Mega Raichu X/Y).`,
    ``,
    `TEAM-BUILDING PRINCIPLES (a good team, not a gimmick pile):`,
    `- BALANCE / don't over-commit: the team must still function if its weather/terrain/Trick Room is removed or its setter faints. Do NOT stack more than ~2-3 of one condition-ability (e.g. Swift Swim). Always include condition-INDEPENDENT threats and a backup win condition.`,
    `- For weather, pair the setter with abusers that don't ALL depend on the speed ability. Rain example: Pelipper/Politoed (setter) + Archaludon (Electro Shot is instant AND boosted in rain — a premier rain pick that needs no Swift Swim) + ONE Swift Swim sweeper + supportive/independent members. Name premier real abusers, not just whatever shares the ability.`,
    `- ROLE COVERAGE — across the finished 6, aim to cover: speed control, redirection or partner protection (Rage Powder / Follow Me), disruption (Fake Out / Intimidate / Taunt), at least one bulky defensive pivot, and an answer to top threats (Incineroar, Kingambit, the strong megas).`,
    `- SPEED IDENTITY: speed control MUST match the team's speed plan. A fast / weather / Swift-Swim / Tailwind core uses Tailwind — do NOT add a Trick Room setter to it. A slow, bulky core uses Trick Room — and then should NOT run Swift Swim or Tailwind. NEVER put Trick Room and Tailwind (or Swift Swim) on the same team; they cancel each other.`,
    `- CONDITIONAL PAYOFFS need their enabler ON THE TEAM: some Pokemon only pay off under a specific weather. Electro Shot (Archaludon) is a 2-turn CHARGE move UNLESS it is raining — instant + SpA-boosted in rain, a liability without it; Solar Beam / Solar Blade skip their charge only in sun; Swift Swim / Chlorophyll / Sand Rush / Slush Rush only boost speed in their weather. ONLY suggest such a Pokemon if THIS team already sets that weather, or you are simultaneously adding the setter. NEVER suggest a rain payoff like Archaludon for a team with no rain source.`,
    `- DEFENSIVE TYPE SYNERGY: cover the core's SHARED weaknesses. When several members fold to the same attacking type (e.g. a Flying + two Water mons all weak to Electric), prefer a partner that is IMMUNE to it via ability AND redirects it — Lightning Rod (Electric), Storm Drain (Water), Flash Fire (Fire), Levitate / Earth Eater (Ground), Sap Sipper (Grass), Thick Fat (Ice/Fire) — so the threat is both neutralised and DRAWN OFF the weak member. A plain resist helps; an ability immunity that also redirects is far better. Also value priority + typing answers (e.g. Kingambit's Sucker Punch + Steel/Dark resisting Ice/Fairy/Rock) for a Flying/physical core.`,
    `- AVOID REDUNDANCY: don't suggest multiple mons with the same role, typing, and shared weakness (e.g. three Water-types all weak to Grass/Electric).`,
    `- Weigh each suggestion by how much it FIXES the current core's biggest gap, not just how flashy it is.`,
    ``,
    `HARD RULES:`,
    `- Suggest ONLY Pokemon from this ALLOWED roster (use these exact names): ${reg.pokemon.join(", ")}.`,
    `- NEVER suggest a Pokemon already on the team, and NEVER suggest anything not on the allowed roster.`,
    `- No Terastallization. Only one Mega Evolution per team.`,
    ``,
    `Respond with ONLY a JSON array (no prose, no markdown fences) of 4 to 6 objects, best first:`,
    `[{"species":"<exact roster name>","category":"synergy"|"coverage"|"role"|"meta","reason":"<1-2 sentences that NAME a current teammate and the concrete mechanism (what this pick enables / protects / pivots in / covers for that member), and/or the threat it answers. No generic praise like 'great coverage'.>"}]`,
  ].join("\n");
}

/** Extract the first JSON array from a possibly-fenced / prose-wrapped reply. */
function extractJsonArray(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  return start >= 0 && end > start ? t.slice(start, end + 1) : t;
}

/** Worst matchups of a team vs recent top-cut teams (shared heuristic). */
export async function computeWorstMatchups(team: AITeamMember[]): Promise<string> {
  if (team.length < 2) return "";
  try {
    const report = await scoreTeamVsTopTeams(
      team.map((m) => m.species),
      { tournamentLimit: 3, topCutSize: 6 },
    );
    if ("error" in report || report.worstMatchups.length === 0) return "";
    return report.worstMatchups
      .slice(0, 3)
      .map((m) => `${m.opponentTeam.join("/")} (matchup ${m.score}/100)`)
      .join("; ");
  } catch {
    return "";
  }
}

/**
 * Top Pikalytics co-usage partners across the current core — the real
 * "Common Teammates" signal, summed per partner and filtered to legal,
 * not-already-on-team picks. Reuses getPikalyticsPokemonDetail.
 */
export async function computePikalyticsPartners(
  team: AITeamMember[],
  format: string,
): Promise<string> {
  const pikaFmt = resolvePikalyticsFormat(format);
  const onTeam = new Set(team.map((m) => m.species.toLowerCase()));
  const score = new Map<string, number>();
  try {
    const details = await Promise.all(
      team.map((m) =>
        getPikalyticsPokemonDetail(m.species, pikaFmt).catch(() => null),
      ),
    );
    for (const d of details) {
      if (!d) continue;
      for (const tm of d.teammates) {
        if (onTeam.has(tm.name.toLowerCase())) continue;
        score.set(tm.name, (score.get(tm.name) ?? 0) + tm.usage);
      }
    }
  } catch {
    return "";
  }
  return [...score.entries()]
    .filter(
      ([name]) =>
        isChampionsPokemon(name, format) &&
        !isConfirmedNotInChampions(name, format),
    )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, s]) => `${name} (${Math.round(s)}%)`)
    .join(", ");
}

/**
 * Generate AI teammate suggestions. Throws "AI_UNAVAILABLE" when no key is
 * set and "AI_PARSE_FAILED" when the model returns unparseable output.
 */
export async function generateAITeamSuggestions(
  team: AITeamMember[],
  format: string,
): Promise<TeamSuggestion[]> {
  if (!isAIAvailable()) throw new Error("AI_UNAVAILABLE");
  if (team.length === 0) return [];

  // In parallel, reuse existing capabilities so the AI is grounded in real
  // data, not just its own priors:
  //  (a) live Pikalytics top-usage threats (the opposing meta),
  //  (b) worst matchups vs real top-cut teams (shared matchup heuristic),
  //  (c) Pikalytics co-usage partners for the current core.
  const [threatList, worstMatchups, pikaPartners] = await Promise.all([
    getLiveMetaThreats(format),
    computeWorstMatchups(team),
    computePikalyticsPartners(team, format),
  ]);
  const threats = threatList
    .slice(0, 12)
    .map((t) => `${t.species} (${t.usagePercent}%)`)
    .join(", ");

  // Infer the team's speed identity so we can hard-block contradictory speed
  // control (e.g. a Trick Room setter on a fast rain team).
  const speedDirective = detectSpeedDirective(team, format);
  // Hard-block weather-locked traps (Archaludon w/o rain) and surface the
  // core's shared defensive weaknesses for ability-immunity coverage.
  const weatherDirective = detectWeatherDirective(team, format);
  const coreWeaknesses = computeCoreWeaknesses(team, format);

  const system = buildSystemPrompt(format);
  const user = [
    `Current team (${team.length}/6):`,
    ...team.map((m) => `- ${describeMember(m, format)}`),
    ``,
    speedDirective,
    weatherDirective,
    coreWeaknesses
      ? `DEFENSIVE WEAKNESSES of your current core (attacking types that threaten 2+ members — prioritise a teammate that RESISTS or, better, is IMMUNE to these via an ability that also redirects, so it shields the weak member):\n${coreWeaknesses}`
      : "",
    `TOP OPPOSING THREATS this team will face (must have answers): ${threats}.`,
    worstMatchups
      ? `The current core's WORST matchups vs recent top-cut teams (lower score = worse) are: ${worstMatchups}. Prioritise teammates that shore up these specific matchups.`
      : "",
    pikaPartners
      ? `REAL Pikalytics co-usage partners for your current core (summed teammate %): ${pikaPartners}. These are battle-tested pairings from live usage data — weight them heavily, but still satisfy the team-building principles and answer the threats above.`
      : "",
    ``,
    `Suggest 4-6 legal teammates that best round out this team — covering the biggest synergy, role, and matchup gaps above, helping against the listed threats, and favouring proven Pikalytics partners where they fit. Return the JSON array only.`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await aiComplete({ system, user }, 1200, "ai_analysis");

  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonArray(res.text));
  } catch {
    throw new Error("AI_PARSE_FAILED");
  }
  if (!Array.isArray(raw)) throw new Error("AI_PARSE_FAILED");

  const onTeam = new Set(team.map((m) => m.species.toLowerCase()));
  const seen = new Set<string>();
  const out: TeamSuggestion[] = [];

  raw.forEach((entry, i) => {
    if (!entry || typeof entry !== "object") return;
    const o = entry as Record<string, unknown>;
    const species = typeof o.species === "string" ? o.species.trim() : "";
    if (!species) return;
    const key = species.toLowerCase();
    // Drop dupes, current members, hallucinations and illegal picks.
    if (seen.has(key) || onTeam.has(key)) return;
    if (!isChampionsPokemon(species, format)) return;
    if (isConfirmedNotInChampions(species, format)) return;

    const catRaw =
      typeof o.category === "string" ? o.category.toLowerCase() : "synergy";
    const category = (VALID_CATEGORIES.has(catRaw as TeamSuggestion["category"])
      ? catRaw
      : "synergy") as TeamSuggestion["category"];
    const reason =
      typeof o.reason === "string" && o.reason.trim()
        ? o.reason.trim()
        : "Synergises with your current core.";

    seen.add(key);
    out.push({ species, category, reason, priority: 100 - i });
  });

  return out.slice(0, 6);
}
