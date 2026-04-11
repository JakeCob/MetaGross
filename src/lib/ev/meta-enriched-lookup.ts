/**
 * Enriched meta spread lookup — server-only.
 *
 * Supplements hardcoded meta spreads with live search data.
 * Separated from meta-lookup.ts to avoid pulling DB/search deps
 * into client component bundles.
 */

import type { MetaSpread } from "@/lib/types/ev";
import { getMetaSpreads } from "./meta-lookup";
import { searchPokemonUsage } from "@/lib/search/meta-enricher";
import { db } from "@/lib/db";
import { analysisCache } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";

const ENRICHED_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get meta spreads enriched with live search data.
 *
 * Returns hardcoded spreads immediately. Attempts to fetch additional
 * data from search APIs and merge/deduplicate. If search fails
 * (no key, rate limited, error), silently falls back to hardcoded only.
 *
 * Results are cached in DB with 24h TTL to avoid repeat searches.
 */
export async function getEnrichedMetaSpreads(
  species: string,
  format: string = "champions-reg-m-a",
): Promise<MetaSpread[]> {
  // Always start with hardcoded data
  const hardcoded = getMetaSpreads(species, format);

  // Check enrichment cache first
  const cacheKey = `enriched-spreads:${species}:${format}`;
  try {
    const cached = db
      .select()
      .from(analysisCache)
      .where(
        and(
          eq(analysisCache.cacheKey, cacheKey),
          gte(analysisCache.expiresAt, Date.now()),
        ),
      )
      .all();

    if (cached.length > 0) {
      const cachedSpreads = cached[0].resultJson as MetaSpread[];
      if (Array.isArray(cachedSpreads) && cachedSpreads.length > 0) {
        console.log(
          `[MetaLookup] Using cached enriched spreads for ${species}`,
        );
        return cachedSpreads;
      }
    }
  } catch (error) {
    console.error("[MetaLookup] Enrichment cache read error:", error);
  }

  // Try to enrich with search data
  try {
    const usageInfo = await searchPokemonUsage(species, format);
    if (!usageInfo || usageInfo.snippets.length === 0) {
      return hardcoded;
    }

    // Parse any EV spreads mentioned in search snippets
    const searchSpreads = parseSearchSpreads(usageInfo.snippets);

    // Merge and deduplicate
    const merged = deduplicateSpreads([...hardcoded, ...searchSpreads]);

    // Cache the enriched result
    try {
      db.delete(analysisCache)
        .where(eq(analysisCache.cacheKey, cacheKey))
        .run();

      db.insert(analysisCache)
        .values({
          cacheKey,
          cacheType: "search:cache",
          resultJson: merged,
          expiresAt: Date.now() + ENRICHED_CACHE_TTL_MS,
        })
        .run();
    } catch (cacheError) {
      console.error("[MetaLookup] Enrichment cache write error:", cacheError);
    }

    console.log(
      `[MetaLookup] Enriched ${species}: ${hardcoded.length} hardcoded + ${searchSpreads.length} from search = ${merged.length} total`,
    );
    return merged;
  } catch (error) {
    // Search failures must never crash — silently fall back to hardcoded
    console.error(
      `[MetaLookup] Search enrichment failed for ${species}, using hardcoded:`,
      error,
    );
    return hardcoded;
  }
}

/**
 * Attempt to parse EV spreads from search result snippets.
 * Looks for patterns like "252 HP / 252 Atk / 4 SpD" in text.
 */
function parseSearchSpreads(snippets: string[]): MetaSpread[] {
  const spreads: MetaSpread[] = [];
  const evPattern =
    /(\d{1,3})\s*(?:HP|Hp|hp)\s*\/\s*(\d{1,3})\s*(?:Atk|ATK|atk)\s*\/\s*(\d{1,3})\s*(?:Def|DEF|def)\s*\/\s*(\d{1,3})\s*(?:SpA|SPA|spa)\s*\/\s*(\d{1,3})\s*(?:SpD|SPD|spd)\s*\/\s*(\d{1,3})\s*(?:Spe|SPE|spe)/gi;
  const naturePattern =
    /\b(Adamant|Jolly|Modest|Timid|Bold|Calm|Careful|Impish|Brave|Quiet|Relaxed|Sassy|Hasty|Naive|Mild|Rash|Lonely|Naughty|Gentle|Lax|Hardy|Docile|Serious|Bashful|Quirky)\b/gi;

  for (const snippet of snippets) {
    let match;
    while ((match = evPattern.exec(snippet)) !== null) {
      const hp = parseInt(match[1], 10);
      const atk = parseInt(match[2], 10);
      const def = parseInt(match[3], 10);
      const spa = parseInt(match[4], 10);
      const spd = parseInt(match[5], 10);
      const spe = parseInt(match[6], 10);

      // Validate total <= 510
      if (hp + atk + def + spa + spd + spe > 510) continue;

      // Try to find a nature near this match
      const nearbyText = snippet.slice(
        Math.max(0, match.index - 50),
        match.index + match[0].length + 50,
      );
      const natureMatch = naturePattern.exec(nearbyText);
      naturePattern.lastIndex = 0; // Reset for next use

      spreads.push({
        evs: { hp, atk, def, spa, spd, spe },
        nature: natureMatch ? natureMatch[1] : "Hardy",
        usagePercent: 0,
        source: "search",
        rank: 99, // Will be re-ranked after dedup
      });
    }
  }

  return spreads;
}

/**
 * Deduplicate spreads by EV + nature combination.
 * Keeps the one with higher usage percent. Re-ranks by usage.
 */
function deduplicateSpreads(spreads: MetaSpread[]): MetaSpread[] {
  const seen = new Map<string, MetaSpread>();

  for (const spread of spreads) {
    const key = `${spread.nature}:${spread.evs.hp}/${spread.evs.atk}/${spread.evs.def}/${spread.evs.spa}/${spread.evs.spd}/${spread.evs.spe}`;
    const existing = seen.get(key);
    if (!existing || spread.usagePercent > existing.usagePercent) {
      seen.set(key, spread);
    }
  }

  // Sort by usage descending, then re-rank
  const result = Array.from(seen.values()).sort(
    (a, b) => b.usagePercent - a.usagePercent,
  );
  return result.map((s, i) => ({ ...s, rank: i + 1 }));
}
