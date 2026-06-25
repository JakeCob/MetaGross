/**
 * Team suggestion engine — powers the builder's "Suggestions" panel.
 *
 * Four modes, all returning a ranked list of proven teams the user can one-click
 * into the builder (the AI mode is handled separately by the debate panel):
 *   - featured:  proven teams that run a given Pokémon
 *   - playstyle: proven teams across the player's preferred archetypes
 *   - meta:      proven teams that best cover the current top-usage threats
 *
 * All proven teams come from the same meta_teams pool as the browser, so each
 * suggestion is one click (full set pulled from its pokepaste) away from a
 * saveable team.
 *
 * SERVER-ONLY.
 */
import "server-only";
import type { MetaTeam } from "./types";
import { listMetaTeams, matchMetaTeams } from "./queries";
import { buildFingerprint } from "./fingerprint";
import { classifyArchetypeFromSnapshot } from "@/lib/team-analysis/team-context";
import { buildPlayerProfile } from "@/lib/profile/build-profile";
import { getLiveMetaThreats } from "@/lib/ev/meta-enriched-lookup";
import { getSpecies } from "@/lib/pokemon/species";
import { getTypeEffectiveness } from "@/lib/pokemon/types";
import { ACTIVE_REGULATION_FORMAT_ID, getRegulation } from "@/lib/data/champions";

const FALLBACK_FORMAT_ID = "champions-reg-m-a";

export type SuggestMode = "featured" | "playstyle" | "meta";

export interface TeamSuggestion {
  team: MetaTeam;
  /** Classified archetype (Rain / Sun / Trick Room / …). */
  archetype: string;
  /** One-line, mode-specific explanation of why this team is suggested. */
  reason: string;
}

export interface SuggestResult {
  mode: SuggestMode;
  suggestions: TeamSuggestion[];
  /** Mode context for the UI header (the threats considered, archetypes used…). */
  context: Record<string, unknown>;
}

const DEFAULT_LIMIT = 8;

function archetypeOf(team: MetaTeam, format: string): string {
  if (team.archetype) return team.archetype;
  const a = classifyArchetypeFromSnapshot(team.pokemon, team.species, format);
  return a === "Unknown" ? "Balance" : a;
}

/** Dedupe teams by their species fingerprint, keeping the first (highest-ranked)
 *  and preferring an entry that carries a pokepaste URL (one-click full set). */
function dedupeByFingerprint(teams: MetaTeam[]): MetaTeam[] {
  const byKey = new Map<string, MetaTeam>();
  for (const t of teams) {
    const key = buildFingerprint(t.species);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, t);
    } else if (!existing.sourceUrl && t.sourceUrl) {
      byKey.set(key, t); // prefer the one we can one-click import in full
    }
  }
  return [...byKey.values()];
}

/** Mode: proven teams that run `species`. */
async function suggestFeatured(
  species: string,
  format: string,
  limit: number,
): Promise<SuggestResult> {
  const matches = await matchMetaTeams({
    species: [species],
    format,
    minOverlap: 1,
    limit: limit * 3,
  });
  const deduped = dedupeByFingerprint(matches.map((m) => m.team)).slice(0, limit);
  const suggestions: TeamSuggestion[] = deduped.map((team) => {
    const archetype = archetypeOf(team, format);
    const others = team.species.filter(
      (s) => s.toLowerCase() !== species.toLowerCase(),
    );
    return {
      team,
      archetype,
      reason: `${archetype} build around ${species}${
        team.record ? ` — ${team.record}` : ""
      }. Pairs it with ${others.slice(0, 3).join(", ")}.`,
    };
  });
  return {
    mode: "featured",
    suggestions,
    context: { species, found: suggestions.length },
  };
}

/** Mode: proven teams across the player's preferred archetypes. */
async function suggestPlaystyle(
  format: string,
  limit: number,
): Promise<SuggestResult> {
  const profile = await buildPlayerProfile().catch(() => null);
  const preferred = (profile?.preferredArchetypes ?? [])
    .map((a) => a.archetype)
    .filter((a) => a !== "Balance" && a !== "Unknown");

  const pool = await listMetaTeams(format, 250);
  const deduped = dedupeByFingerprint(pool);

  // Group by classified archetype.
  const byArchetype = new Map<string, MetaTeam[]>();
  for (const t of deduped) {
    const a = archetypeOf(t, format);
    if (!byArchetype.has(a)) byArchetype.set(a, []);
    byArchetype.get(a)!.push(t);
  }

  // Preferred archetypes first (in profile order), then fill with variety.
  const order =
    preferred.length > 0
      ? preferred
      : [...byArchetype.keys()].filter((a) => a !== "Balance");
  const ordered = [...order, ...[...byArchetype.keys()].filter((a) => !order.includes(a))];

  // Round-robin across archetypes for a diverse spread.
  const suggestions: TeamSuggestion[] = [];
  let added = true;
  let round = 0;
  while (suggestions.length < limit && added) {
    added = false;
    for (const a of ordered) {
      const list = byArchetype.get(a);
      if (list && list[round]) {
        const team = list[round];
        suggestions.push({
          team,
          archetype: a,
          reason:
            preferred.includes(a)
              ? `${a} — one of your favored styles.${team.record ? ` ${team.record}` : ""}`
              : `${a} — a strong proven option.${team.record ? ` ${team.record}` : ""}`,
        });
        added = true;
        if (suggestions.length >= limit) break;
      }
    }
    round++;
  }

  return {
    mode: "playstyle",
    suggestions,
    context: { preferredArchetypes: preferred, usedProfile: !!profile },
  };
}

async function runMode(
  mode: SuggestMode,
  formatId: string,
  species: string | undefined,
  limit: number,
): Promise<SuggestResult> {
  switch (mode) {
    case "featured":
      if (!species?.trim()) {
        return { mode: "featured", suggestions: [], context: { species: null } };
      }
      return suggestFeatured(species.trim(), formatId, limit);
    case "playstyle":
      return suggestPlaystyle(formatId, limit);
    case "meta":
      return suggestMeta(formatId, limit);
  }
}

export async function suggestTeams(opts: {
  mode: SuggestMode;
  species?: string;
  format?: string;
  limit?: number;
}): Promise<SuggestResult> {
  // The builder passes a display format ("Champions Reg M-B"); resolve it to the
  // internal id meta_teams is keyed by (same as the proven-teams browser).
  const formatId = getRegulation(opts.format ?? ACTIVE_REGULATION_FORMAT_ID).formatId;
  const limit = opts.limit ?? DEFAULT_LIMIT;

  const result = await runMode(opts.mode, formatId, opts.species, limit);
  // Fall back to the previous regulation if the current one has nothing indexed
  // yet (mirrors the proven-teams browser's behavior).
  if (result.suggestions.length === 0 && formatId !== FALLBACK_FORMAT_ID && opts.mode !== "featured") {
    const fb = await runMode(opts.mode, FALLBACK_FORMAT_ID, opts.species, limit);
    if (fb.suggestions.length > 0) {
      return { ...fb, context: { ...fb.context, fallback: true } };
    }
  }
  return result;
}

/** Cached species → types lookup (avoids re-hitting the dex per team). */
const typeCache = new Map<string, string[]>();
function speciesTypes(name: string): string[] {
  let t = typeCache.get(name);
  if (t === undefined) {
    t = getSpecies(name)?.types ?? [];
    typeCache.set(name, t);
  }
  return t;
}

/**
 * Mode: rank proven teams by how well they answer the current top-usage threats.
 * For each top threat we ask whether a team can (a) hit it super-effectively
 * (any member type ≥2× into the threat's types — STAB proxy) OR (b) wall it (a
 * member that resists BOTH of the threat's STABs). Coverage = answered / total.
 */
async function suggestMeta(
  format: string,
  limit: number,
): Promise<SuggestResult> {
  const threats = (await getLiveMetaThreats(format, 10).catch(() => [])).slice(0, 8);
  const pool = dedupeByFingerprint(await listMetaTeams(format, 250));

  const threatInfo = threats
    .map((th) => ({ species: th.species, usage: th.usagePercent, types: speciesTypes(th.species) }))
    .filter((th) => th.types.length > 0);

  // No live usage data → degrade gracefully to top recent proven teams.
  if (threatInfo.length === 0) {
    const suggestions = pool.slice(0, limit).map((team) => ({
      team,
      archetype: archetypeOf(team, format),
      reason: `Proven recent team.${team.record ? ` ${team.record}` : ""}`,
    }));
    return { mode: "meta", suggestions, context: { threats: [], note: "no live usage data" } };
  }

  const scored = pool.map((team) => {
    const memberTypes = team.species.map(speciesTypes).filter((ts) => ts.length > 0);
    const checked: string[] = [];
    let usageScore = 0;
    for (const th of threatInfo) {
      // A genuine CHECK: one member that hits the threat super-effectively AND
      // isn't weak to either of its STABs (resisting at least one) — i.e. it
      // both threatens back and can take a hit, rather than merely sharing a
      // super-effective type. This differentiates teams instead of "8/8 for all".
      const isChecked = memberTypes.some((ts) => {
        const hitsSE = ts.some((mt) => getTypeEffectiveness(mt, th.types) >= 2);
        if (!hitsSE) return false;
        const notWeak = th.types.every((tt) => getTypeEffectiveness(tt, ts) <= 1);
        const resistsOne = th.types.some((tt) => getTypeEffectiveness(tt, ts) <= 0.5);
        return notWeak && resistsOne;
      });
      if (isChecked) {
        checked.push(th.species);
        usageScore += th.usage; // weight by how common the threat is
      }
    }
    return { team, checked, score: usageScore };
  });

  scored.sort((a, b) => b.score - a.score || b.team.trust - a.team.trust);

  const suggestions: TeamSuggestion[] = scored.slice(0, limit).map((s) => ({
    team: s.team,
    archetype: archetypeOf(s.team, format),
    reason: `Checks ${s.checked.length}/${threatInfo.length} top threats${
      s.checked.length ? ` (${s.checked.slice(0, 3).join(", ")}${s.checked.length > 3 ? "…" : ""})` : ""
    }.${s.team.record ? ` ${s.team.record}` : ""}`,
  }));

  return {
    mode: "meta",
    suggestions,
    context: { threats: threatInfo.map((t) => ({ species: t.species, usage: t.usage })) },
  };
}
