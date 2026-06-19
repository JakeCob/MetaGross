/**
 * Regulation analysis — powers the /meta/regulation page.
 *
 * Two layers:
 *  1. FACTUAL breakdown (getMbContentBreakdown) — the new species / megas /
 *     items derived purely from the REGULATIONS diff + @pkmn/dex. No AI, so
 *     it's always accurate.
 *  2. AI INSIGHTS (getRegulationAnalysis) — meta-impact narrative + predicted
 *     teams, grounded in the scraped meta_teams pool and live web search,
 *     cached in analysis_cache (with a manual refresh). Degrades gracefully
 *     to null when no AI key is set.
 *
 * Server-only — imports @pkmn/dex, the AI client, the DB and web search.
 */
import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { analysisCache } from "@/lib/db/schema";
import { aiComplete, isAIAvailable } from "@/lib/ai/client";
import { searchVGCMeta } from "@/lib/search";
import { listMetaTeams } from "@/lib/meta-teams/queries";
import { getRegulation, ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";
import { getLiveMetaThreats } from "@/lib/ev/meta-enriched-lookup";
import { getMbContentBreakdown } from "@/lib/data/regulation-diff";
import type {
  MbContentBreakdown,
  MbSpeciesEntry,
  MbMegaEntry,
  MbItemEntry,
} from "@/lib/data/regulation-diff";

// Re-export the factual breakdown + its types so callers can grab everything
// from this module.
export { getMbContentBreakdown };
export type { MbContentBreakdown, MbSpeciesEntry, MbMegaEntry, MbItemEntry };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PredictedTeam {
  name: string;
  archetype: string;
  core: string[];
  reasoning: string;
}

export interface MetaImpactPoint {
  title: string;
  detail: string;
}

/** How to upgrade a known M-A archetype to compete in the new regulation. */
export interface TeamAdaptation {
  archetype: string;
  /** Representative M-A core this is based on. */
  baseTeam: string[];
  changes: { swap: string; reasoning: string }[];
  strategy: string;
}

export interface RegulationInsights {
  summary: string;
  metaImpact: MetaImpactPoint[];
  spotlights: { name: string; verdict: string }[];
  predictedTeams: PredictedTeam[];
  /** Upgrade paths from the previous regulation's meta teams. */
  adaptations: TeamAdaptation[];
  /** General gameplay strategies for the new regulation. */
  strategies: { title: string; detail: string }[];
  sources: { title: string; url: string }[];
  generatedAt: number;
  model: string;
}

// ---------------------------------------------------------------------------
// AI insights
// ---------------------------------------------------------------------------

function cacheKeyFor(format: string): string {
  return `regulation-analysis:${format}`;
}

const INSIGHTS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Top species across the scraped meta-team pool, most-used first. */
function speciesFrequency(
  teams: Awaited<ReturnType<typeof listMetaTeams>>,
): { species: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of teams) {
    for (const sp of t.species) {
      counts.set(sp, (counts.get(sp) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([species, count]) => ({ species, count }))
    .sort((a, b) => b.count - a.count);
}

function extractJsonObject(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  return start >= 0 && end > start ? t.slice(start, end + 1) : t;
}

/**
 * Hand-curated sources whose content we've already extracted (e.g. a creator
 * video with no machine-readable transcript). Prepended to web search so the
 * analysis reflects them and they show up under Sources.
 */
const CURATED_SOURCES: { title: string; url: string; snippet: string }[] = [
  {
    title:
      "CybertronVGC — “The NEW Pokemon Champions format is HERE” (Reg M-B breakdown)",
    url: "https://youtu.be/Mf5Hm_S6CYc",
    snippet:
      "Creator breakdown of Reg M-B: Mega Staraptor gains Contrary (pairs with Close Combat to snowball stat drops into boosts); Mega Raichu X/Y set their terrain unopposed; Life Orb returns to the format; Eelektross-Mega's signature ability is Eelevate; key nerfs — Annihilape's Rage Fist loses its stored damage stacks on switch-out, and Grimmsnarl loses Thunder Wave; Kingambit stays dominant (~70% usage) and Toxapex remains a defensive staple; Vileplume is a notable new option.",
  },
];

async function gatherWebSources(
  regLabel: string,
): Promise<{ title: string; url: string; snippet: string }[]> {
  const queries = [
    `Pokemon Champions ${regLabel} VGC meta analysis`,
    `Pokemon Champions ${regLabel} best new Pokemon mega evolution`,
    `Pokemon Champions ${regLabel} team archetypes tier list`,
  ];
  const seen = new Set<string>();
  const out: { title: string; url: string; snippet: string }[] = [];
  for (const q of queries) {
    try {
      const results = await searchVGCMeta(q);
      for (const r of results.slice(0, 5)) {
        if (seen.has(r.url)) continue;
        seen.add(r.url);
        out.push({ title: r.title, url: r.url, snippet: r.snippet });
      }
    } catch {
      // Search keys may be unset / provider down — degrade to no web context.
    }
    if (out.length >= 12) break;
  }
  return out;
}

function buildInsightsPrompt(
  breakdown: MbContentBreakdown,
  topSpecies: { species: string; count: number }[],
  exampleTeams: Awaited<ReturnType<typeof listMetaTeams>>,
  maTeams: Awaited<ReturnType<typeof listMetaTeams>>,
  web: { title: string; url: string; snippet: string }[],
  threatLines: string,
): { system: string; user: string } {
  const reg = getRegulation(ACTIVE_REGULATION_FORMAT_ID);
  const megaLines = breakdown.newMegas
    .map((m) => `${m.mega} (stone ${m.stone}, ability ${m.ability ?? "—"})`)
    .join("; ");
  const itemLines = breakdown.newItems
    .map((i) => `${i.item} [${i.status}]`)
    .join(", ");
  const usageLines = topSpecies
    .slice(0, 25)
    .map((s) => `${s.species} (${s.count})`)
    .join(", ");
  const teamLines = exampleTeams
    .slice(0, 10)
    .map(
      (t) =>
        `- ${t.archetype ?? "team"} [${t.record ?? "?"}]: ${t.species.join(", ")}`,
    )
    .join("\n");
  const webLines = web
    .map((w, i) => `[${i + 1}] ${w.title} — ${w.snippet}`)
    .join("\n");
  const maTeamLines = maTeams
    .slice(0, 12)
    .map(
      (t) =>
        `- ${t.archetype ?? "team"} [${t.record ?? "?"}]: ${t.species.join(", ")}`,
    )
    .join("\n");

  const system = [
    `You are a Pokemon VGC meta analyst for Pokemon ${reg.label} (Champions).`,
    `Format: Doubles, bring 6 pick 4, level 50, Mega Evolution ON, NO Terastallization, IVs fixed 31, ${reg.points.totalMax}-point stat system.`,
    `${reg.label} is ADDITIVE over ${breakdown.previous}: it only ADDS the content below and un-bans a few items. Everything legal before is still legal.`,
    ``,
    `NEW POKEMON (${breakdown.counts.species}): ${breakdown.newSpecies.map((s) => s.species + (s.unbanned ? " (un-banned)" : "")).join(", ")}.`,
    `NEW MEGAS (${breakdown.counts.megas}): ${megaLines}.`,
    `NEW/UN-BANNED ITEMS: ${itemLines}.`,
    ``,
    `Reason concretely about mechanics — e.g. Mega Raichu X gets Electric Surge (auto Electric Terrain) which boosts Electric moves and blocks sleep/priority, enabling terrain offense; Life Orb being un-banned raises raw damage ceilings; Mega Metagross (Tough Claws) and Mega Mawile (Huge Power) reintroduce strong physical breakers; weather (Swift Swim Mega Swampert in rain), Trick Room, and redirection all matter.`,
    `Ground predicted teams in the real scraped tournament data and the web context provided. Only use Pokemon legal in ${reg.label}.`,
    `TOP OPPOSING THREATS predicted teams and adaptations must answer: ${threatLines}.`,
    `TEAM-BUILDING PRINCIPLES — predicted teams and adaptations must be BALANCED, not one-dimensional: don't make a team that collapses if its weather/terrain/Trick Room is removed; stack at most ~2-3 of one condition-ability (e.g. Swift Swim) and include condition-independent threats + a backup win condition. Pair weather setters with premier abusers that don't all need the speed ability (rain → include Archaludon, whose Electro Shot is instant + boosted in rain, not just Swift Swim mons). Across the 6 cover speed control, redirection/protection, disruption (Fake Out/Intimidate), a bulky pivot, and answers to top threats; avoid 3 mons sharing a role/typing/weakness. Speed control must MATCH the team's speed plan — a fast/weather/Tailwind/Swift-Swim core uses Tailwind, a slow/bulky core uses Trick Room; NEVER mix Trick Room with Tailwind or Swift Swim on the same team (they cancel).`,
    ``,
    `Respond with ONLY a JSON object (no prose, no markdown fences):`,
    `{`,
    `  "summary": "<2-4 sentence overview of how ${reg.label} changes the meta>",`,
    `  "metaImpact": [{"title":"<short>","detail":"<1-2 sentences with the mechanic + why>"}, ... 4-6 items],`,
    `  "spotlights": [{"name":"<new Pokemon/mega/item>","verdict":"<one-line take on its impact>"}, ... 5-8 items],`,
    `  "predictedTeams": [{"name":"<catchy name>","archetype":"<e.g. Electric Terrain HO>","core":["Species1","Species2","Species3"],"reasoning":"<why it works + what it beats>"}, ... 3-5 teams],`,
    `  "adaptations": [{"archetype":"<a ${breakdown.previous} archetype below>","baseTeam":["S1","S2","S3","S4"],"changes":[{"swap":"<concrete edit, e.g. '+ Mega Metagross over Tyranitar' or 'give Garchomp Life Orb'>","reasoning":"<why it improves vs the new meta>"}],"strategy":"<one-line updated gameplan>"}, ... 3-4 adaptations],`,
    `  "strategies": [{"title":"<short>","detail":"<actionable gameplan/teching advice for the new meta>"}, ... 3-5],`,
    `  "sourcesUsed": [<indices of web sources you relied on, e.g. 1,3>]`,
    `}`,
    ``,
    `For "adaptations": take real ${breakdown.previous} meta teams/archetypes (listed in the user message) and show how to UPGRADE them for ${reg.label} — swap in the new Pokemon/megas/items where they're a strict improvement, and explain why. Keep base teams recognizable.`,
  ].join("\n");

  const user = [
    `SCRAPED ${reg.label} TOURNAMENT USAGE (species, # of teams): ${usageLines || "(none yet — very early in the reg)"}.`,
    ``,
    `EXAMPLE SCRAPED ${reg.label} TEAMS:`,
    teamLines || "(none scraped yet)",
    ``,
    `PREVIOUS REGULATION (${breakdown.previous}) META TEAMS — adapt these:`,
    maTeamLines || "(none available)",
    ``,
    `WEB CONTEXT (numbered):`,
    webLines || "(no web results available)",
    ``,
    `Produce the JSON analysis now.`,
  ].join("\n");

  return { system, user };
}

/**
 * Generate fresh insights (no caching). Throws "AI_UNAVAILABLE" when no key.
 */
async function generateRegulationInsights(
  format: string,
): Promise<RegulationInsights> {
  if (!isAIAvailable()) throw new Error("AI_UNAVAILABLE");

  const breakdown = getMbContentBreakdown(format);
  const [teams, maTeams, gathered, threats] = await Promise.all([
    listMetaTeams(format, 60),
    listMetaTeams("champions-reg-m-a", 40),
    gatherWebSources(breakdown.regulation),
    getLiveMetaThreats(format),
  ]);
  const threatLines =
    threats
      .slice(0, 12)
      .map((t) => `${t.species} (${t.usagePercent}%)`)
      .join(", ") || "(no live usage data yet)";
  // Curated sources first, then web search — deduped by URL.
  const seenUrl = new Set<string>();
  const web = [...CURATED_SOURCES, ...gathered].filter((w) => {
    if (seenUrl.has(w.url)) return false;
    seenUrl.add(w.url);
    return true;
  });
  const top = speciesFrequency(teams);

  const { system, user } = buildInsightsPrompt(
    breakdown,
    top,
    teams,
    maTeams,
    web,
    threatLines,
  );
  const res = await aiComplete({ system, user }, 4096, "ai_analysis");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJsonObject(res.text));
  } catch {
    throw new Error("AI_PARSE_FAILED");
  }

  const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const usedIdx = new Set(
    asArray<number>(parsed.sourcesUsed).map((n) => Number(n)),
  );
  // Prefer the sources the model cited; fall back to all gathered.
  const sources = web
    .map((w, i) => ({ ...w, idx: i + 1 }))
    .filter((w) => (usedIdx.size > 0 ? usedIdx.has(w.idx) : true))
    .map((w) => ({ title: w.title, url: w.url }));

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    metaImpact: asArray<MetaImpactPoint>(parsed.metaImpact)
      .filter((p) => p && typeof p.title === "string")
      .map((p) => ({ title: String(p.title), detail: String(p.detail ?? "") })),
    spotlights: asArray<{ name: string; verdict: string }>(parsed.spotlights)
      .filter((s) => s && typeof s.name === "string")
      .map((s) => ({ name: String(s.name), verdict: String(s.verdict ?? "") })),
    predictedTeams: asArray<PredictedTeam>(parsed.predictedTeams)
      .filter((t) => t && typeof t.name === "string")
      .map((t) => ({
        name: String(t.name),
        archetype: String(t.archetype ?? ""),
        core: asArray<string>(t.core).map(String),
        reasoning: String(t.reasoning ?? ""),
      })),
    adaptations: asArray<TeamAdaptation>(parsed.adaptations)
      .filter((a) => a && typeof a.archetype === "string")
      .map((a) => ({
        archetype: String(a.archetype),
        baseTeam: asArray<string>(a.baseTeam).map(String),
        changes: asArray<{ swap: string; reasoning: string }>(a.changes)
          .filter((c) => c && typeof c.swap === "string")
          .map((c) => ({
            swap: String(c.swap),
            reasoning: String(c.reasoning ?? ""),
          })),
        strategy: String(a.strategy ?? ""),
      })),
    strategies: asArray<{ title: string; detail: string }>(parsed.strategies)
      .filter((s) => s && typeof s.title === "string")
      .map((s) => ({ title: String(s.title), detail: String(s.detail ?? "") })),
    sources,
    generatedAt: Date.now(),
    model: res.model,
  };
}

/**
 * Get cached insights, or generate + cache them. Returns null (not an error)
 * when AI is unavailable so the page can still show the factual breakdown.
 */
export async function getRegulationAnalysis(
  format: string = ACTIVE_REGULATION_FORMAT_ID,
  opts: { forceRefresh?: boolean; readOnly?: boolean } = {},
): Promise<{ insights: RegulationInsights | null; cached: boolean }> {
  const cacheKey = cacheKeyFor(format);

  if (!opts.forceRefresh) {
    const row = await db
      .select()
      .from(analysisCache)
      .where(eq(analysisCache.cacheKey, cacheKey))
      .get();
    if (row && (!row.expiresAt || row.expiresAt > Date.now())) {
      return { insights: row.resultJson as RegulationInsights, cached: true };
    }
  }

  // readOnly: don't spend tokens generating — let the UI offer a button.
  if (opts.readOnly) return { insights: null, cached: false };

  if (!isAIAvailable()) return { insights: null, cached: false };

  const insights = await generateRegulationInsights(format);
  const expiresAt = Date.now() + INSIGHTS_TTL_MS;
  const existing = await db
    .select({ id: analysisCache.id })
    .from(analysisCache)
    .where(eq(analysisCache.cacheKey, cacheKey))
    .get();
  if (existing) {
    await db
      .update(analysisCache)
      .set({
        resultJson: insights as unknown as Record<string, unknown>,
        model: insights.model,
        expiresAt,
        createdAt: Date.now(),
      })
      .where(eq(analysisCache.cacheKey, cacheKey))
      .run();
  } else {
    await db
      .insert(analysisCache)
      .values({
        cacheKey,
        cacheType: "regulation-analysis",
        resultJson: insights as unknown as Record<string, unknown>,
        model: insights.model,
        expiresAt,
      })
      .run();
  }

  return { insights, cached: false };
}
