/**
 * Exa AI semantic search client.
 *
 * Uses company-borrowed API key with strict daily rate limits.
 * POST to https://api.exa.ai/search
 */

import { checkRateLimit, recordSearchUsage } from "@/lib/ai/rate-limiter";

export interface ExaResult {
  title: string;
  url: string;
  text: string;
  score: number;
  publishedDate?: string;
}

interface ExaResponseResult {
  title?: string;
  url?: string;
  text?: string;
  score?: number;
  publishedDate?: string;
}

interface ExaResponse {
  results?: ExaResponseResult[];
}

/**
 * Semantic search via Exa AI.
 * Rate-limited to 10 calls/day (company key).
 */
export async function searchExa(
  query: string,
  numResults?: number,
): Promise<ExaResult[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error("EXA_API_KEY is not configured");
  }

  // Check rate limit before calling
  const limit = checkRateLimit("search", "exa");
  if (!limit.allowed) {
    throw new Error(
      `Exa daily limit reached (${limit.used}/${limit.limit}). Try again tomorrow.`,
    );
  }

  console.log(`[Exa] Searching: "${query}" (num=${numResults ?? 5})`);

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      numResults: numResults ?? 5,
      type: "auto",
      contents: {
        text: { maxCharacters: 500 },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Exa API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as ExaResponse;
  const rawResults = data.results ?? [];

  const results: ExaResult[] = rawResults.map((item) => ({
    title: item.title ?? "",
    url: item.url ?? "",
    text: item.text ?? "",
    score: item.score ?? 0,
    publishedDate: item.publishedDate,
  }));

  // Record usage after successful call
  recordSearchUsage("exa", query);

  console.log(`[Exa] Got ${results.length} results for "${query}"`);

  return results;
}
