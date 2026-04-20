/**
 * Creator-teams aggregator.
 *
 * Ingests hand-verified teams from CREATOR_TEAMS (Wolfe Glick, etc.)
 * into the meta_teams pool with source="creator" and trust=1.0 —
 * highest possible because these are directly attributed and vetted.
 *
 * Why this matters: Limitless only has teams that enter tracked
 * tournaments. Famous players (Wolfe) often share teams on YouTube/
 * Twitter without entering every weekly event, so pure-Limitless
 * ingestion misses them. This aggregator fills that gap.
 *
 * SERVER-ONLY (uses DB queries).
 */
import "server-only";

import { CREATOR_TEAMS } from "@/lib/data/creator-teams";
import { upsertMetaTeam } from "./queries";

export interface AggregateCreatorsOptions {
  /** Limit to a specific format. Default: "champions-reg-m-a". */
  format?: string;
  onProgress?: (event: { creator: string; title: string; index: number; total: number }) => void;
}

export interface AggregateCreatorsResult {
  considered: number;
  inserted: number;
  updated: number;
  errors: Array<{ teamId: string; error: string }>;
}

export function aggregateFromCreators(
  opts: AggregateCreatorsOptions = {},
): AggregateCreatorsResult {
  const format = opts.format ?? "champions-reg-m-a";
  const eligible = CREATOR_TEAMS.filter((t) => t.format === format);

  const result: AggregateCreatorsResult = {
    considered: 0,
    inserted: 0,
    updated: 0,
    errors: [],
  };

  for (let i = 0; i < eligible.length; i++) {
    const t = eligible[i];
    result.considered++;
    try {
      const species = t.pokemon.map((p) => p.species).filter(Boolean);
      if (species.length === 0) continue;

      const seenAt = t.date ? new Date(t.date).getTime() : Date.now();

      // Fingerprint-level dedupe happens in upsertMetaTeam.
      // Detect insert vs update heuristically by seenAt — cheap and
      // good enough for the summary.
      const beforeTime = Date.now();
      upsertMetaTeam({
        source: "creator",
        sourceRef: `${t.creatorHandle}::${t.id}`,
        sourceUrl: t.videoUrl ?? t.creatorUrl ?? null,
        format,
        author: t.creator,
        record: t.title,
        archetype: t.archetype,
        description: t.strategy ?? t.description ?? null,
        species,
        pokemon: t.pokemon.map((p) => ({
          species: p.species,
          ability: p.ability || undefined,
          item: p.item || undefined,
          nature: p.nature || undefined,
          moves: p.moves,
          teraType: p.tera || undefined,
          evs: p.evs || undefined,
          ivs: p.ivs || undefined,
        })),
        trust: 1.0,
        seenAt,
      });

      // Cheap inserted-vs-updated discriminator: if upsertMetaTeam
      // took <1ms it was probably an update hit on the indexed
      // fingerprint. Not perfect, but avoids a second DB read.
      if (Date.now() - beforeTime < 2) {
        result.updated++;
      } else {
        result.inserted++;
      }
    } catch (err) {
      result.errors.push({
        teamId: t.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    opts.onProgress?.({
      creator: t.creator,
      title: t.title,
      index: i,
      total: eligible.length,
    });
  }

  return result;
}
