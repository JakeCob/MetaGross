/**
 * Multi-source meta aggregator (SERVER-ONLY).
 *
 * Combines competitive usage data from Pikalytics, Limitless VGC, and Smogon
 * into a single unified view. Each source is fetched in parallel and the
 * results are merged with configurable weights.
 *
 * Do NOT import this file from client components — it uses the `server-only`
 * guard and should stay out of client bundles.
 */
import "server-only";

import {
  getPikalyticsTopUsage,
  getPikalyticsPokemonDetail,
  DEFAULT_PIKALYTICS_FORMAT,
  PIKALYTICS_FORMAT_IDS,
} from "./pikalytics";
import {
  getTournamentUsage,
  getTournamentPokemonDetail,
  getChampionsTournaments,
  getTournamentStandings,
} from "./limitless";
import { getTopUsage as getSmogonTopUsage, getSmogonStats } from "./smogon";

/** Smogon only has data for these format prefixes */
function isSmogonFormat(format: string): boolean {
  return format.startsWith("gen") && !PIKALYTICS_FORMAT_IDS.has(format);
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AggregatedPokemonUsage {
  rank: number;
  species: string;
  sources: {
    pikalytics?: { usage: number };
    limitless?: { usage: number; appearances: number; totalTeams: number };
    smogon?: { usage: number };
  };
  combinedUsage: number;
}

export interface AggregatedPokemonDetail {
  species: string;
  moves: { name: string; usage: number; sources: string[] }[];
  items: { name: string; usage: number; sources: string[] }[];
  abilities: { name: string; usage: number; sources: string[] }[];
  teammates: { name: string; usage: number; sources: string[] }[];
  teraTypes?: { name: string; usage: number; sources: string[] }[];
  tournamentTeams?: {
    player: string;
    placement: number;
    team: string[];
  }[];
  featuredTeams?: {
    player: string;
    record: string;
    pokemon: string[];
    set?: { ability: string; item: string; moves: string[] };
  }[];
  dataSources: string[];
}

// ---------------------------------------------------------------------------
// Weights for combining usage data across sources
// ---------------------------------------------------------------------------

const WEIGHTS = {
  pikalytics: 0.5, // Ladder data (most players)
  limitless: 0.3, // Tournament data (competitive top cut)
  smogon: 0.2, // Showdown data (broad / fallback)
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise a species name for case-insensitive matching. */
function normaliseKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Merge entries from multiple sources by name.
 * Returns averaged usage and tracks which sources contributed.
 */
function mergeUsageEntries(
  ...entrySets: {
    source: string;
    entries: { name: string; usage: number }[];
  }[]
): { name: string; usage: number; sources: string[] }[] {
  const merged = new Map<
    string,
    { displayName: string; totalUsage: number; count: number; sources: string[] }
  >();

  for (const { source, entries } of entrySets) {
    for (const entry of entries) {
      const key = normaliseKey(entry.name);
      const existing = merged.get(key);
      if (existing) {
        existing.totalUsage += entry.usage;
        existing.count += 1;
        if (!existing.sources.includes(source)) {
          existing.sources.push(source);
        }
      } else {
        merged.set(key, {
          displayName: entry.name,
          totalUsage: entry.usage,
          count: 1,
          sources: [source],
        });
      }
    }
  }

  return Array.from(merged.values())
    .map((m) => ({
      name: m.displayName,
      usage: Math.round((m.totalUsage / m.count) * 100) / 100,
      sources: m.sources,
    }))
    .sort((a, b) => b.usage - a.usage);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get aggregated top usage across all available sources.
 *
 * Fetches Pikalytics, Limitless, and Smogon in parallel. Pokemon are merged
 * by species name and ranked by a weighted combined usage score.
 */
export async function getAggregatedTopUsage(
  format?: string,
): Promise<AggregatedPokemonUsage[]> {
  const pikalyticsFormat = format ?? DEFAULT_PIKALYTICS_FORMAT;
  const smogonFormat = format ?? "gen9vgc2026";
  const useSmogon = isSmogonFormat(smogonFormat);

  // Fetch available sources in parallel — failures return empty arrays
  const [pikalyticsData, limitlessData, smogonData] = await Promise.all([
    getPikalyticsTopUsage(pikalyticsFormat).catch((err) => {
      console.error("[aggregator] Pikalytics failed:", err);
      return [];
    }),
    getTournamentUsage().catch((err) => {
      console.error("[aggregator] Limitless failed:", err);
      return [];
    }),
    useSmogon
      ? getSmogonTopUsage(smogonFormat, 50).catch((err) => {
          console.error("[aggregator] Smogon failed:", err);
          return [];
        })
      : Promise.resolve([]),
  ]);

  // Build lookup maps keyed by normalised species name
  const pikalyticsMap = new Map(
    pikalyticsData.map((p) => [normaliseKey(p.species), p]),
  );
  const limitlessMap = new Map(
    limitlessData.map((p) => [normaliseKey(p.species), p]),
  );
  const smogonMap = new Map(
    smogonData.map((p) => [normaliseKey(p.species), p]),
  );

  // Collect all unique species across sources
  const allSpeciesKeys = new Set([
    ...pikalyticsMap.keys(),
    ...limitlessMap.keys(),
    ...smogonMap.keys(),
  ]);

  const results: AggregatedPokemonUsage[] = [];

  for (const key of allSpeciesKeys) {
    const pike = pikalyticsMap.get(key);
    const lim = limitlessMap.get(key);
    const smog = smogonMap.get(key);

    // Determine display name (prefer Pikalytics > Limitless > Smogon)
    const species =
      pike?.species ?? lim?.species ?? smog?.species ?? key;

    // Build sources object
    const sources: AggregatedPokemonUsage["sources"] = {};
    if (pike) sources.pikalytics = { usage: pike.usagePercent };
    if (lim) {
      sources.limitless = {
        usage: lim.usagePercent,
        appearances: lim.totalAppearances,
        totalTeams: lim.totalTeams,
      };
    }
    if (smog) sources.smogon = { usage: smog.usage };

    // Weighted average — only count sources that have data
    let weightedSum = 0;
    let weightTotal = 0;

    if (pike) {
      weightedSum += pike.usagePercent * WEIGHTS.pikalytics;
      weightTotal += WEIGHTS.pikalytics;
    }
    if (lim) {
      weightedSum += lim.usagePercent * WEIGHTS.limitless;
      weightTotal += WEIGHTS.limitless;
    }
    if (smog) {
      weightedSum += smog.usage * WEIGHTS.smogon;
      weightTotal += WEIGHTS.smogon;
    }

    const combinedUsage =
      weightTotal > 0
        ? Math.round((weightedSum / weightTotal) * 100) / 100
        : 0;

    results.push({
      rank: 0, // will be set after sorting
      species,
      sources,
      combinedUsage,
    });
  }

  // Sort by combined usage descending and assign ranks
  results.sort((a, b) => b.combinedUsage - a.combinedUsage);
  results.forEach((r, i) => {
    r.rank = i + 1;
  });

  return results;
}

/**
 * Get aggregated detail for a specific Pokemon from all available sources.
 */
export async function getAggregatedPokemonDetail(
  species: string,
  format?: string,
): Promise<AggregatedPokemonDetail | null> {
  const pikalyticsFormat = format ?? DEFAULT_PIKALYTICS_FORMAT;
  const smogonFormat = format ?? "gen9vgc2026";
  const useSmogon = isSmogonFormat(smogonFormat);

  // Fetch available sources in parallel
  const [pikaDetail, limDetail, smogDetail] = await Promise.all([
    getPikalyticsPokemonDetail(species, pikalyticsFormat).catch((err) => {
      console.error("[aggregator] Pikalytics detail failed:", err);
      return null;
    }),
    getTournamentPokemonDetail(species).catch((err) => {
      console.error("[aggregator] Limitless detail failed:", err);
      return null;
    }),
    useSmogon
      ? getSmogonStats(species, smogonFormat).catch((err) => {
          console.error("[aggregator] Smogon detail failed:", err);
          return null;
        })
      : Promise.resolve(null),
  ]);

  // If no data from any source, return null
  if (!pikaDetail && !limDetail && !smogDetail) return null;

  const dataSources: string[] = [];
  if (pikaDetail) dataSources.push("pikalytics");
  if (limDetail) dataSources.push("limitless");
  if (smogDetail) dataSources.push("smogon");

  // Build entry sets for merging
  const moveSets: { source: string; entries: { name: string; usage: number }[] }[] = [];
  const itemSets: typeof moveSets = [];
  const abilitySets: typeof moveSets = [];
  const teammateSets: typeof moveSets = [];
  const teraSets: typeof moveSets = [];

  if (pikaDetail) {
    moveSets.push({ source: "pikalytics", entries: pikaDetail.moves });
    itemSets.push({ source: "pikalytics", entries: pikaDetail.items });
    abilitySets.push({ source: "pikalytics", entries: pikaDetail.abilities });
    teammateSets.push({ source: "pikalytics", entries: pikaDetail.teammates });
  }

  if (limDetail) {
    moveSets.push({ source: "limitless", entries: limDetail.moves });
    itemSets.push({ source: "limitless", entries: limDetail.items });
    abilitySets.push({ source: "limitless", entries: limDetail.abilities });
    teammateSets.push({ source: "limitless", entries: limDetail.teammates });
    if (limDetail.teraTypes.length > 0) {
      teraSets.push({ source: "limitless", entries: limDetail.teraTypes });
    }
  }

  if (smogDetail) {
    moveSets.push({ source: "smogon", entries: smogDetail.moves });
    itemSets.push({ source: "smogon", entries: smogDetail.items });
    abilitySets.push({ source: "smogon", entries: smogDetail.abilities });
    teammateSets.push({ source: "smogon", entries: smogDetail.teammates });
    if (smogDetail.teraTypes && smogDetail.teraTypes.length > 0) {
      teraSets.push({ source: "smogon", entries: smogDetail.teraTypes });
    }
  }

  // Gather tournament team data from Limitless
  let tournamentTeams: AggregatedPokemonDetail["tournamentTeams"];
  if (limDetail && limDetail.appearances > 0) {
    try {
      const tournaments = await getChampionsTournaments();
      const recent = tournaments.slice(0, 5);
      const teams: NonNullable<AggregatedPokemonDetail["tournamentTeams"]> = [];

      const allStandings = await Promise.all(
        recent.map((t) => getTournamentStandings(t.id)),
      );

      const speciesLower = species.toLowerCase();

      for (const standings of allStandings) {
        for (const standing of standings) {
          const hasMon = standing.team.some(
            (m) => m.species.toLowerCase() === speciesLower,
          );
          if (hasMon) {
            teams.push({
              player: standing.name,
              placement: standing.placement,
              team: standing.team.map((m) => m.species),
            });
          }
        }
      }

      // Sort by placement and take top 10
      teams.sort((a, b) => a.placement - b.placement);
      tournamentTeams = teams.slice(0, 10);
    } catch {
      // Non-critical — skip tournament teams
    }
  }

  return {
    species,
    moves: mergeUsageEntries(...moveSets),
    items: mergeUsageEntries(...itemSets),
    abilities: mergeUsageEntries(...abilitySets),
    teammates: mergeUsageEntries(...teammateSets),
    teraTypes: teraSets.length > 0 ? mergeUsageEntries(...teraSets) : undefined,
    tournamentTeams,
    featuredTeams: pikaDetail?.featuredTeams,
    dataSources,
  };
}
