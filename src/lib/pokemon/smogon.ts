/**
 * Live Smogon usage data client (SERVER-ONLY).
 *
 * Wraps @pkmn/smogon to fetch and parse competitive usage statistics.
 * Do NOT import this file from client components — it relies on Node APIs
 * and the @pkmn/smogon package which should stay out of client bundles.
 */
import "server-only";

import { Smogon, type DisplayStatistics, type DisplayUsageStatistics } from "@pkmn/smogon";
import type { ID } from "@pkmn/data";
import { generations } from "./generations";

// ---------------------------------------------------------------------------
// Smogon client singleton
// ---------------------------------------------------------------------------
const smogon = new Smogon(fetch);
const gen = generations.get(9);

const DATA_URL = "https://data.pkmn.cc";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
export interface PokemonUsageStats {
  species: string;
  usagePercent: number;
  /** Top moves with usage % */
  moves: { name: string; usage: number }[];
  /** Top items with usage % */
  items: { name: string; usage: number }[];
  /** Top abilities with usage % */
  abilities: { name: string; usage: number }[];
  /** Top EV spreads (e.g. "252 Atk / 252 Spe / 4 HP") with usage % */
  spreads: { spread: string; usage: number }[];
  /** Top teammates with usage % */
  teammates: { name: string; usage: number }[];
  /** Tera types with usage % */
  teraTypes: { name: string; usage: number }[];
}

// ---------------------------------------------------------------------------
// In-memory cache for full format statistics
// ---------------------------------------------------------------------------
interface CachedFormatStats {
  data: DisplayStatistics;
  fetchedAt: number;
}

const formatStatsCache = new Map<string, CachedFormatStats>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sort a Record<string, number> descending by value, return top N as array. */
function topEntries(
  record: Record<string, number> | undefined,
  limit: number,
): { name: string; usage: number }[] {
  if (!record) return [];
  return Object.entries(record)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([name, usage]) => ({ name, usage: round(usage) }));
}

/** Round to 3 decimal places. */
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Parse a stats key like "252 Atk / 252 Spe / 4 HP" — these are already
 * human-readable from @pkmn/stats, so we keep them as-is but validate.
 */
function parseSpreadEntries(
  statsRecord: Record<string, number> | undefined,
  limit: number,
): { spread: string; usage: number }[] {
  if (!statsRecord) return [];
  return Object.entries(statsRecord)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([spread, usage]) => ({ spread, usage: round(usage) }));
}

// ---------------------------------------------------------------------------
// Fetch full format statistics (for top usage list)
// ---------------------------------------------------------------------------
async function fetchFormatStats(format: string): Promise<DisplayStatistics | null> {
  const cached = formatStatsCache.get(format);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const response = await fetch(`${DATA_URL}/stats/${format}.json`);
    if (!response.ok) return null;
    const data: DisplayStatistics = await response.json();
    formatStatsCache.set(format, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    console.error(`[smogon] Failed to fetch format stats for ${format}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get detailed usage stats for a specific Pokemon in a given format.
 */
export async function getSmogonStats(
  species: string,
  format: string = "gen9vgc2025",
): Promise<PokemonUsageStats | null> {
  try {
    // First try via the Smogon class which has internal caching
    const stats = await smogon.stats(gen, species, format as ID);
    if (!stats) return null;

    const usageStats = stats as DisplayUsageStatistics;

    return {
      species,
      usagePercent: round((usageStats.usage?.weighted ?? 0) * 100),
      moves: topEntries(usageStats.moves, 10),
      items: topEntries(usageStats.items, 5),
      abilities: topEntries(usageStats.abilities, 5),
      spreads: parseSpreadEntries(usageStats.stats, 5),
      teammates: topEntries(usageStats.teammates, 8),
      teraTypes: topEntries(usageStats.teraTypes, 8),
    };
  } catch (err) {
    console.error(`[smogon] Failed to get stats for ${species}:`, err);
    return null;
  }
}

/**
 * Get the top N most-used Pokemon in a format.
 *
 * Fetches the full statistics JSON for the format from data.pkmn.cc
 * and ranks Pokemon by weighted usage.
 */
export async function getTopUsage(
  format: string = "gen9vgc2025",
  limit: number = 20,
): Promise<{ species: string; usage: number }[]> {
  try {
    const data = await fetchFormatStats(format);
    if (!data?.pokemon) return [];

    return Object.entries(data.pokemon)
      .map(([name, stats]) => ({
        species: name,
        usage: round(((stats as DisplayUsageStatistics).usage?.weighted ?? 0) * 100),
      }))
      .filter((p) => p.usage > 0)
      .sort((a, b) => b.usage - a.usage)
      .slice(0, limit);
  } catch (err) {
    console.error(`[smogon] Failed to get top usage for ${format}:`, err);
    return [];
  }
}

/**
 * List available VGC format IDs.
 */
export const DEFAULT_VGC_FORMAT = "gen9vgc2026";

export const VGC_FORMATS = [
  { id: "gen9vgc2026", label: "VGC 2026 (Champions / Reg M-A)" },
  { id: "gen9vgc2025", label: "VGC 2025 (Reg I)" },
  { id: "gen9vgc2024", label: "VGC 2024" },
  { id: "gen9vgc2023", label: "VGC 2023" },
  { id: "gen8vgc2022", label: "VGC 2022" },
  { id: "gen8vgc2021", label: "VGC 2021" },
  { id: "gen8vgc2020", label: "VGC 2020" },
  { id: "gen7vgc2019", label: "VGC 2019" },
  { id: "gen7vgc2018", label: "VGC 2018" },
  { id: "gen7vgc2017", label: "VGC 2017" },
] as const;
