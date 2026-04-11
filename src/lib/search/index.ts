/**
 * Unified search module.
 *
 * Priority: Bing (personal, unlimited) > Serper (company, 10/day) > Exa (company, 10/day).
 * Returns empty array if no key is configured (graceful degradation).
 */

import { searchBing, type BingResult } from "./bing";
import { searchGoogle, type SerperResult } from "./serper";
import { searchExa, type ExaResult } from "./exa";

export { searchBing, type BingResult } from "./bing";
export { searchGoogle, type SerperResult } from "./serper";
export { searchExa, type ExaResult } from "./exa";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: "bing" | "serper" | "exa";
  score?: number;
  publishedDate?: string;
}

/**
 * Unified VGC meta search.
 *
 * Priority: Bing (personal, unlimited) > Serper (company, rate-limited) > Exa (company, rate-limited).
 */
export async function searchVGCMeta(query: string): Promise<SearchResult[]> {
  // Try Bing first (personal key, unlimited)
  if (process.env.BING_API_KEY) {
    try {
      const results = await searchBing(query);
      return results.map(bingToSearchResult);
    } catch (error) {
      console.error("[Search] Bing failed, trying Serper fallback:", error);
    }
  }

  // Try Serper (company key, rate-limited)
  if (process.env.SERPER_API_KEY) {
    try {
      const results = await searchGoogle(query);
      return results.map(serperToSearchResult);
    } catch (error) {
      console.error("[Search] Serper failed, trying Exa fallback:", error);
    }
  }

  // Try Exa (company key, rate-limited)
  if (process.env.EXA_API_KEY) {
    try {
      const results = await searchExa(query);
      return results.map(exaToSearchResult);
    } catch (error) {
      console.error("[Search] Exa also failed:", error);
      return [];
    }
  }

  console.log("[Search] No search API keys configured. Returning empty results.");
  return [];
}

function bingToSearchResult(result: BingResult): SearchResult {
  return {
    title: result.title,
    url: result.url,
    snippet: result.snippet,
    source: "bing",
    publishedDate: result.dateLastCrawled,
  };
}

function serperToSearchResult(result: SerperResult): SearchResult {
  return {
    title: result.title,
    url: result.link,
    snippet: result.snippet,
    source: "serper",
  };
}

function exaToSearchResult(result: ExaResult): SearchResult {
  return {
    title: result.title,
    url: result.url,
    snippet: result.text,
    source: "exa",
    score: result.score,
    publishedDate: result.publishedDate,
  };
}
