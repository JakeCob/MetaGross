/**
 * Meta data enricher using search APIs.
 *
 * Builds VGC-specific queries and parses results into structured data.
 * Caches results in analysisCache with 24h TTL.
 */

import { db } from "@/lib/db";
import { analysisCache } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { searchVGCMeta, type SearchResult } from "./index";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TournamentResult {
  name: string;
  url: string;
  snippet: string;
  source: "bing" | "serper" | "exa";
}

export interface UsageInfo {
  species: string;
  format: string;
  snippets: string[];
  sources: { title: string; url: string }[];
}

export interface TeamReport {
  title: string;
  url: string;
  snippet: string;
  source: "bing" | "serper" | "exa";
  publishedDate?: string;
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCached<T>(cacheKey: string): T | null {
  try {
    const rows = db
      .select()
      .from(analysisCache)
      .where(
        and(
          eq(analysisCache.cacheKey, cacheKey),
          gte(analysisCache.expiresAt, Date.now()),
        ),
      )
      .all();

    if (rows.length > 0) {
      console.log(`[MetaEnricher] Cache hit: ${cacheKey}`);
      return rows[0].resultJson as T;
    }
  } catch (error) {
    console.error("[MetaEnricher] Cache read error:", error);
  }
  return null;
}

function setCache(cacheKey: string, data: unknown): void {
  try {
    // Upsert: delete old entry then insert
    db.delete(analysisCache)
      .where(eq(analysisCache.cacheKey, cacheKey))
      .run();

    db.insert(analysisCache)
      .values({
        cacheKey,
        cacheType: "search:cache",
        resultJson: data,
        expiresAt: Date.now() + CACHE_TTL_MS,
      })
      .run();
  } catch (error) {
    console.error("[MetaEnricher] Cache write error:", error);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search for tournament results in the given format.
 */
export async function searchTournamentResults(
  format: string,
): Promise<TournamentResult[]> {
  const cacheKey = `tournament:${format}`;
  const cached = getCached<TournamentResult[]>(cacheKey);
  if (cached) return cached;

  try {
    const query = `Pokemon VGC ${format} tournament results top cut 2026`;
    console.log(`[MetaEnricher] Searching tournaments: "${query}"`);

    const results = await searchVGCMeta(query);
    const parsed = results.map(toTournamentResult);

    setCache(cacheKey, parsed);
    console.log(
      `[MetaEnricher] Found ${parsed.length} tournament results for ${format}`,
    );
    return parsed;
  } catch (error) {
    console.error("[MetaEnricher] Tournament search failed:", error);
    return [];
  }
}

/**
 * Search for Pokemon usage stats and EV spreads.
 */
export async function searchPokemonUsage(
  species: string,
  format: string,
): Promise<UsageInfo | null> {
  const cacheKey = `usage:${species}:${format}`;
  const cached = getCached<UsageInfo>(cacheKey);
  if (cached) return cached;

  try {
    const query = `${species} VGC ${format} usage stats EV spread`;
    console.log(`[MetaEnricher] Searching usage: "${query}"`);

    const results = await searchVGCMeta(query);
    if (results.length === 0) return null;

    const usageInfo: UsageInfo = {
      species,
      format,
      snippets: results.map((r) => r.snippet).filter(Boolean),
      sources: results.map((r) => ({ title: r.title, url: r.url })),
    };

    setCache(cacheKey, usageInfo);
    console.log(
      `[MetaEnricher] Found usage info for ${species} in ${format}`,
    );
    return usageInfo;
  } catch (error) {
    console.error("[MetaEnricher] Usage search failed:", error);
    return null;
  }
}

/**
 * Search for team reports and analysis articles.
 */
export async function searchTeamReports(
  format: string,
): Promise<TeamReport[]> {
  const cacheKey = `teamreports:${format}`;
  const cached = getCached<TeamReport[]>(cacheKey);
  if (cached) return cached;

  try {
    const query = `Pokemon VGC ${format} team report analysis 2026`;
    console.log(`[MetaEnricher] Searching team reports: "${query}"`);

    const results = await searchVGCMeta(query);
    const parsed = results.map(toTeamReport);

    setCache(cacheKey, parsed);
    console.log(
      `[MetaEnricher] Found ${parsed.length} team reports for ${format}`,
    );
    return parsed;
  } catch (error) {
    console.error("[MetaEnricher] Team report search failed:", error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Result mappers
// ---------------------------------------------------------------------------

function toTournamentResult(result: SearchResult): TournamentResult {
  return {
    name: result.title,
    url: result.url,
    snippet: result.snippet,
    source: result.source,
  };
}

function toTeamReport(result: SearchResult): TeamReport {
  return {
    title: result.title,
    url: result.url,
    snippet: result.snippet,
    source: result.source,
    publishedDate: result.publishedDate,
  };
}
