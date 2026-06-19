/**
 * Smogon dex analysis fetcher (SERVER-ONLY).
 *
 * Pulls Pokemon analysis pages from Smogon's dex RPC endpoint
 * (https://www.smogon.com/dex/_rpc/dump-pokemon) and returns the
 * overview + teambuilding notes + sample sets + full learnset.
 *
 * Format selection: Champions Reg M-A isn't a Smogon format, so we
 * pick the closest-match analysis in this order:
 *   1. Latest "VGC{YY} Regulation {X}" strategy (most recent written).
 *   2. Generic "VGC" strategy.
 *   3. "Doubles".
 *   4. Any strategy.
 *
 * Cached 24h in-memory (same pattern as limitless.ts / pikalytics.ts).
 * SERVER-ONLY.
 */
import "server-only";

import { ACTIVE_REGULATION_LABEL } from "@/lib/data/champions";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SmogonMoveset {
  name: string;
  pokemon?: string;
  level?: number;
  moveslots?: Array<Array<{ move: string; type?: string }>>;
  abilities?: string[];
  items?: string[];
  teratypes?: string[];
  natures?: string[];
  evconfigs?: Array<{
    hp?: number;
    atk?: number;
    def?: number;
    spa?: number;
    spd?: number;
    spe?: number;
  }>;
  ivconfigs?: Array<{
    hp?: number;
    atk?: number;
    def?: number;
    spa?: number;
    spd?: number;
    spe?: number;
  }>;
  description?: string;
}

export interface SmogonStrategy {
  format: string;
  overview: string;
  comments: string;
  movesets: SmogonMoveset[];
  outdated: string | null;
  credits?: unknown;
}

export interface SmogonPokemonAnalysis {
  species: string;
  /** The strategy we actually returned (format + whether it's the canonical VGC one). */
  strategyFormat: string;
  strategySelectedReason: string;
  overview: string;
  comments: string;
  movesets: SmogonMoveset[];
  learnset: string[];
  /** Every strategy format available — helpful when the agent wants a specific reg. */
  availableFormats: string[];
  /** URL the user can click to see the full analysis. */
  sourceUrl: string;
}

// ---------------------------------------------------------------------------
// Constants + cache
// ---------------------------------------------------------------------------

const RPC_URL = "https://www.smogon.com/dex/_rpc/dump-pokemon";
const USER_AGENT = "MetaGross/1.0 (VGC analysis tool)";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6000;

interface CacheEntry {
  data: SmogonPokemonAnalysis | null;
  fetchedAt: number;
}
const cache = new Map<string, CacheEntry>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch a Pokemon's Smogon analysis. Returns null when the species
 * isn't on Smogon or every provider failed. Auto-selects the most
 * relevant VGC-adjacent strategy.
 */
export async function getSmogonAnalysis(
  species: string,
  options: { preferFormat?: string; language?: string } = {},
): Promise<SmogonPokemonAnalysis | null> {
  const alias = speciesToAlias(species);
  if (!alias) return null;

  const lang = options.language ?? "en";
  const cacheKey = `${alias}:${lang}:${options.preferFormat ?? "auto"}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  let payload: RpcResult;
  try {
    const res = await timedFetch(RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ alias, gen: "sv", language: lang }),
    });
    if (!res.ok) {
      cache.set(cacheKey, { data: null, fetchedAt: Date.now() });
      return null;
    }
    payload = (await res.json()) as RpcResult;
  } catch (err) {
    console.info(
      `[smogon-analysis] ${alias} failed:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }

  if (!payload?.strategies || payload.strategies.length === 0) {
    cache.set(cacheKey, { data: null, fetchedAt: Date.now() });
    return null;
  }

  const { strategy, reason } = pickStrategy(
    payload.strategies,
    options.preferFormat,
  );
  if (!strategy) {
    cache.set(cacheKey, { data: null, fetchedAt: Date.now() });
    return null;
  }

  // Backfill missing prose from the richest alternate VGC/Doubles
  // strategy. VGC regs often have overview-only or comments-only;
  // generic "VGC" frequently has both. Fill gaps so the agent gets a
  // complete-looking analysis, with a note about the source split.
  const richest = pickRichestProseStrategy(payload.strategies, strategy);
  const mergedOverview = strategy.overview?.trim() ? strategy.overview : richest?.overview ?? "";
  const mergedComments = strategy.comments?.trim() ? strategy.comments : richest?.comments ?? "";
  const enrichedReason =
    richest && richest !== strategy &&
    (!strategy.overview?.trim() || !strategy.comments?.trim())
      ? `${reason}; prose backfilled from ${richest.format} (format-specific writeup was sparse)`
      : reason;

  const result: SmogonPokemonAnalysis = {
    species,
    strategyFormat: strategy.format,
    strategySelectedReason: enrichedReason,
    overview: htmlToText(mergedOverview),
    comments: htmlToText(mergedComments),
    movesets: strategy.movesets ?? [],
    learnset: payload.learnset ?? [],
    availableFormats: payload.strategies.map((s) => s.format),
    sourceUrl: buildSmogonUrl(alias, strategy.format),
  };

  cache.set(cacheKey, { data: result, fetchedAt: Date.now() });
  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface RpcResult {
  learnset?: string[];
  strategies?: SmogonStrategy[];
  languages?: string[];
}

function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Smogon's dex aliases are lowercase species names with hyphens for
 * forms and spaces removed. "Mr. Mime" → "mr-mime"; "Flutter Mane" →
 * "flutter-mane"; "Urshifu-Rapid-Strike" → "urshifu-rapid-strike".
 */
function speciesToAlias(species: string): string {
  return species
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Find the strategy with the most prose content overall (overview +
 * comments length). Used to backfill sparse format-specific
 * strategies. Only considers VGC/Doubles-adjacent strategies — we
 * don't want to inject NU singles advice into a VGC reg writeup.
 */
function pickRichestProseStrategy(
  strategies: SmogonStrategy[],
  excluding: SmogonStrategy,
): SmogonStrategy | null {
  const proseLen = (s: SmogonStrategy) =>
    (s.overview ?? "").trim().length + (s.comments ?? "").trim().length;
  const candidates = strategies
    .filter((s) => s !== excluding)
    .filter(
      (s) =>
        s.format === "VGC" ||
        s.format === "Doubles" ||
        /^VGC\d+\s+Regulation\s+[A-Z]/i.test(s.format),
    )
    .sort((a, b) => proseLen(b) - proseLen(a));
  return candidates[0] ?? null;
}

function hasProse(s: SmogonStrategy): boolean {
  return (
    (s.overview ?? "").trim().length > 20 ||
    (s.comments ?? "").trim().length > 20
  );
}
function hasSets(s: SmogonStrategy): boolean {
  return Array.isArray(s.movesets) && s.movesets.length > 0;
}

function pickStrategy(
  strategies: SmogonStrategy[],
  preferFormat?: string,
): { strategy: SmogonStrategy | null; reason: string } {
  // User-requested format wins outright.
  if (preferFormat) {
    const exact = strategies.find(
      (s) => s.format.toLowerCase() === preferFormat.toLowerCase(),
    );
    if (exact) return { strategy: exact, reason: `exact match for ${preferFormat}` };
    const contains = strategies.find((s) =>
      s.format.toLowerCase().includes(preferFormat.toLowerCase()),
    );
    if (contains)
      return { strategy: contains, reason: `substring match for ${preferFormat}` };
  }

  const isVgcReg = (s: SmogonStrategy) =>
    /^VGC\d+\s+Regulation\s+[A-Z]/i.test(s.format);
  const vgcRegsByRecency = strategies
    .filter(isVgcReg)
    .sort((a, b) => regSortKey(b.format).localeCompare(regSortKey(a.format)));

  // Priority ladder: prose (most useful) → sets-only → any. Within
  // each tier we prefer the latest VGC reg, then generic VGC, then
  // Doubles, then anything.
  const tiers: Array<{
    candidates: SmogonStrategy[];
    reasonPrefix: string;
  }> = [
    {
      candidates: [
        ...vgcRegsByRecency.filter(hasProse),
        ...strategies.filter((s) => s.format === "VGC" && hasProse(s)),
        ...strategies.filter((s) => s.format === "Doubles" && hasProse(s)),
        ...strategies.filter((s) => hasProse(s)),
      ],
      reasonPrefix: "analysis with prose",
    },
    {
      candidates: [
        ...vgcRegsByRecency.filter(hasSets),
        ...strategies.filter((s) => s.format === "VGC" && hasSets(s)),
        ...strategies.filter((s) => s.format === "Doubles" && hasSets(s)),
        ...strategies.filter((s) => hasSets(s)),
      ],
      reasonPrefix: "analysis with sample sets (no prose writeup)",
    },
    {
      candidates: strategies,
      reasonPrefix: "bare analysis entry (no prose or sets)",
    },
  ];

  for (const tier of tiers) {
    const pick = tier.candidates[0];
    if (!pick) continue;
    return {
      strategy: pick,
      reason: `${tier.reasonPrefix} — ${pick.format}${
        isVgcReg(pick) ? ` (${ACTIVE_REGULATION_LABEL} has no dedicated Smogon writeup)` : ""
      }`,
    };
  }

  return { strategy: null, reason: "no strategies available" };
}

function regSortKey(format: string): string {
  const m = format.match(/^VGC(\d+)\s+Regulation\s+([A-Z])/i);
  if (!m) return format;
  // Year + regulation letter for lexicographic sort. Year padded so
  // 25-I sorts after 24-I.
  return `${m[1].padStart(3, "0")}-${m[2].toUpperCase()}`;
}

function buildSmogonUrl(alias: string, format: string): string {
  const formatSlug = formatToSlug(format);
  return `https://www.smogon.com/dex/sv/pokemon/${alias}/${formatSlug}/`;
}

function formatToSlug(format: string): string {
  // "VGC25 Regulation I" → "vgc25-reg-i"
  const reg = format.match(/^VGC(\d+)\s+Regulation\s+([A-Z])/i);
  if (reg) return `vgc${reg[1]}-reg-${reg[2].toLowerCase()}`;
  if (format === "VGC") return "vgc";
  return format.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Smogon dex HTML uses <p>, <ul>, <li>, <a>, <h3>, etc. Convert to
 * plain text keeping structure (newline-per-block, bullet markers for
 * lists) so the agent can read it without stripping markdown itself.
 */
function htmlToText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "  - ")
    .replace(/<\/ul>|<\/ol>/gi, "\n")
    .replace(/<h[1-6][^>]*>/gi, "\n## ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
