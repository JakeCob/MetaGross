/**
 * Pikalytics featured-team aggregator.
 *
 * Pulls per-species featured teams from Pikalytics's machine-readable
 * endpoints and inserts them into the meta_teams table. Pikalytics
 * lists featured teams under each species' page (player, record, and
 * the other 5 Pokemon), so a single team typically shows up 6 times —
 * once per species it contains. The `speciesFingerprint` uniqueness
 * means we dedupe naturally.
 *
 * SERVER-ONLY.
 */
import "server-only";

import {
  getPikalyticsTopUsage,
  getPikalyticsPokemonDetail,
  DEFAULT_PIKALYTICS_FORMAT,
} from "@/lib/pokemon/pikalytics";
import { upsertMetaTeam } from "./queries";

export interface AggregatePikalyticsOptions {
  /** Pikalytics format id (e.g. "championspreview"). */
  format?: string;
  /** Internal format label stored on the row (e.g. "champions-reg-m-a"). */
  internalFormat?: string;
  /** How many top-used species to walk. Default 30 — enough to cover
   *  most meta teams without hammering Pikalytics. */
  topN?: number;
  /** Called once per species processed — for progress UI / logs. */
  onProgress?: (event: {
    species: string;
    index: number;
    total: number;
    teamsFound: number;
  }) => void;
}

export interface AggregatePikalyticsResult {
  speciesScanned: number;
  featuredTeamsConsidered: number;
  teamsInserted: number;
  teamsUpdated: number;
  errors: Array<{ species: string; error: string }>;
}

const PIKALYTICS_FORMAT_TO_INTERNAL: Record<string, string> = {
  championspreview: "champions-reg-m-a",
  gen9vgc2026regf: "vgc-2026-reg-f",
  gen9vgc2025regi: "vgc-2025-reg-i",
};

/**
 * Run the aggregator. Returns stats — does not throw on per-species
 * failures so one bad page doesn't kill the whole run.
 */
export async function aggregateFromPikalytics(
  opts: AggregatePikalyticsOptions = {},
): Promise<AggregatePikalyticsResult> {
  const format = opts.format ?? DEFAULT_PIKALYTICS_FORMAT;
  const internalFormat =
    opts.internalFormat ?? PIKALYTICS_FORMAT_TO_INTERNAL[format] ?? format;
  const topN = opts.topN ?? 30;

  const result: AggregatePikalyticsResult = {
    speciesScanned: 0,
    featuredTeamsConsidered: 0,
    teamsInserted: 0,
    teamsUpdated: 0,
    errors: [],
  };

  const topUsage = await getPikalyticsTopUsage(format);
  if (topUsage.length === 0) {
    result.errors.push({ species: "<top-usage>", error: "no top-usage data" });
    return result;
  }

  const species = topUsage.slice(0, topN).map((u) => u.species);
  const fingerprintsSeenThisRun = new Set<string>();

  for (let i = 0; i < species.length; i++) {
    const spName = species[i];
    let teamsFound = 0;
    try {
      const detail = await getPikalyticsPokemonDetail(spName, format);
      if (!detail) {
        opts.onProgress?.({
          species: spName,
          index: i,
          total: species.length,
          teamsFound: 0,
        });
        result.speciesScanned++;
        continue;
      }

      for (const featured of detail.featuredTeams) {
        if (!Array.isArray(featured.pokemon) || featured.pokemon.length === 0) {
          continue;
        }
        result.featuredTeamsConsidered++;

        // Include the "anchor" species (this page) so we have all 6 where
        // possible — Pikalytics lists the other 5 in `pokemon`.
        const speciesList = Array.from(
          new Set([spName, ...featured.pokemon].map((s) => s.trim()).filter(Boolean)),
        );

        // Build the fingerprint client-side first so we can detect a
        // same-run dupe before touching the DB.
        const { buildFingerprint } = await import("./fingerprint");
        const fp = buildFingerprint(speciesList);
        const isNewThisRun = !fingerprintsSeenThisRun.has(fp);
        fingerprintsSeenThisRun.add(fp);

        // Per-anchor set (when Pikalytics gives us one for this species).
        const pokemonData = featured.set
          ? [
              {
                species: spName,
                ability: featured.set.ability,
                item: featured.set.item,
                moves: featured.set.moves,
              },
            ]
          : [];

        upsertMetaTeam({
          source: "pikalytics",
          sourceRef: `${spName}::${featured.player}::${featured.record}`,
          sourceUrl: `https://www.pikalytics.com/pokedex/${format}/${encodeURIComponent(spName)}`,
          format: internalFormat,
          author: featured.player,
          record: featured.record,
          archetype: null,
          description: null,
          species: speciesList,
          pokemon: pokemonData,
          trust: 0.9,
          seenAt: Date.now(),
        });

        if (isNewThisRun) {
          result.teamsInserted++;
          teamsFound++;
        } else {
          result.teamsUpdated++;
        }
      }

      result.speciesScanned++;
    } catch (err) {
      result.errors.push({
        species: spName,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    opts.onProgress?.({
      species: spName,
      index: i,
      total: species.length,
      teamsFound,
    });
  }

  return result;
}
