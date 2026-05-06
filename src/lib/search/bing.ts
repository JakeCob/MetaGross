/**
 * Bing Web Search client.
 *
 * Personal API key — no rate limits enforced.
 * GET to https://api.bing.microsoft.com/v7.0/search
 */

import { recordSearchUsage } from "@/lib/ai/rate-limiter";

export interface BingResult {
  title: string;
  url: string;
  snippet: string;
  dateLastCrawled?: string;
}

interface BingWebPage {
  name?: string;
  url?: string;
  snippet?: string;
  dateLastCrawled?: string;
}

interface BingResponse {
  webPages?: {
    value?: BingWebPage[];
  };
}

/**
 * Search via Bing Web Search API.
 * Personal key — unlimited usage.
 */
export async function searchBing(
  query: string,
  numResults?: number,
): Promise<BingResult[]> {
  const apiKey = process.env.BING_API_KEY;
  if (!apiKey) {
    throw new Error("BING_API_KEY is not configured");
  }

  const count = numResults ?? 5;
  const params = new URLSearchParams({
    q: query,
    count: String(count),
    responseFilter: "Webpages",
  });

  console.log(`[Bing] Searching: "${query}" (count=${count})`);

  const response = await fetch(
    `https://api.bing.microsoft.com/v7.0/search?${params}`,
    {
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Bing API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as BingResponse;
  const pages = data.webPages?.value ?? [];

  const results: BingResult[] = pages.map((item) => ({
    title: item.name ?? "",
    url: item.url ?? "",
    snippet: item.snippet ?? "",
    dateLastCrawled: item.dateLastCrawled,
  }));

  // Record usage (personal key, but still track for visibility)
  await recordSearchUsage("bing", query);

  console.log(`[Bing] Got ${results.length} results for "${query}"`);

  return results;
}
