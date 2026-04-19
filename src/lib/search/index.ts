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
 *
 * Logging convention: when a provider fails but a fallback succeeds,
 * emit a single INFO log. Only escalate to ERROR when every configured
 * provider has failed — prevents "Bing 401" spam in the console every
 * time the agent issues a search.
 */
export async function searchVGCMeta(query: string): Promise<SearchResult[]> {
  const failures: Array<{ provider: string; error: unknown }> = [];

  // Try Bing first (personal key, unlimited)
  if (process.env.BING_API_KEY) {
    try {
      const results = await searchBing(query);
      return results.map(bingToSearchResult);
    } catch (error) {
      failures.push({ provider: "bing", error });
    }
  }

  // Try Serper (company key, rate-limited)
  if (process.env.SERPER_API_KEY) {
    try {
      const results = await searchGoogle(query);
      if (failures.length > 0) {
        console.info(
          `[Search] ${failures[0].provider} failed, served via serper instead`,
        );
      }
      return results.map(serperToSearchResult);
    } catch (error) {
      failures.push({ provider: "serper", error });
    }
  }

  // Try Exa (company key, rate-limited)
  if (process.env.EXA_API_KEY) {
    try {
      const results = await searchExa(query);
      if (failures.length > 0) {
        console.info(
          `[Search] ${failures.map((f) => f.provider).join(", ")} failed, served via exa instead`,
        );
      }
      return results.map(exaToSearchResult);
    } catch (error) {
      failures.push({ provider: "exa", error });
    }
  }

  // Only log ERRORS when every provider failed (or none was configured).
  if (failures.length > 0) {
    console.error(
      "[Search] All providers failed:",
      failures.map((f) => `${f.provider}: ${describeError(f.error)}`).join(" | "),
    );
  } else {
    console.log("[Search] No search API keys configured. Returning empty results.");
  }
  return [];
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
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
