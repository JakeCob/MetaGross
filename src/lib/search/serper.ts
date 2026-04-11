/**
 * Serper Google Search client.
 *
 * Uses company-borrowed API key with strict daily rate limits.
 * POST to https://google.serper.dev/search
 */

import { checkRateLimit, recordSearchUsage } from "@/lib/ai/rate-limiter";

export interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

interface SerperOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
}

/**
 * Search Google via Serper API.
 * Rate-limited to 10 calls/day (company key).
 */
export async function searchGoogle(
  query: string,
  numResults?: number,
): Promise<SerperResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error("SERPER_API_KEY is not configured");
  }

  // Check rate limit before calling
  const limit = checkRateLimit("search", "serper");
  if (!limit.allowed) {
    throw new Error(
      `Serper daily limit reached (${limit.used}/${limit.limit}). Try again tomorrow.`,
    );
  }

  console.log(`[Serper] Searching: "${query}" (num=${numResults ?? 5})`);

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      num: numResults ?? 5,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Serper API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as SerperResponse;
  const organic = data.organic ?? [];

  const results: SerperResult[] = organic.map((item, index) => ({
    title: item.title ?? "",
    link: item.link ?? "",
    snippet: item.snippet ?? "",
    position: item.position ?? index + 1,
  }));

  // Record usage after successful call
  recordSearchUsage("serper", query);

  console.log(`[Serper] Got ${results.length} results for "${query}"`);

  return results;
}
