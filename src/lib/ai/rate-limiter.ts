import { db } from "@/lib/db";
import { analysisCache } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";

// Daily limits — only for borrowed/company keys
// OpenAI is personal (unlimited), company keys get capped
const DAILY_LIMITS = {
  ai_analysis: 10,
  pre_match: 10,
  ev_optimize: 5,
  search: 10,
} as const;

type UsageType = keyof typeof DAILY_LIMITS;

function getTodayStart(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

/**
 * Check if a usage type has remaining quota for today.
 * Only enforced for non-OpenAI providers (company keys).
 */
export function checkRateLimit(
  type: UsageType,
  provider: string,
): {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
} {
  // No rate limit on personal keys (OpenAI, Bing)
  if (provider === "openai" || provider === "bing") {
    return { allowed: true, used: 0, limit: Infinity, remaining: Infinity };
  }

  const todayStart = getTodayStart();
  const limit = DAILY_LIMITS[type];

  const rows = db
    .select()
    .from(analysisCache)
    .where(
      and(
        eq(analysisCache.cacheType, `${type}:${provider}`),
        gte(analysisCache.createdAt, todayStart),
      ),
    )
    .all();

  const used = rows.length;
  const remaining = Math.max(0, limit - used);

  return { allowed: used < limit, used, limit, remaining };
}

/**
 * Record a usage event. Call AFTER a successful API call.
 */
export function recordUsage(
  type: UsageType,
  details: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheKey?: string;
  },
): void {
  const costPerInputToken =
    details.provider === "openai" ? 2.5 / 1_000_000 : 3.0 / 1_000_000;
  const costPerOutputToken =
    details.provider === "openai" ? 10.0 / 1_000_000 : 15.0 / 1_000_000;
  const estimatedCost =
    details.inputTokens * costPerInputToken +
    details.outputTokens * costPerOutputToken;

  db.insert(analysisCache)
    .values({
      cacheKey: details.cacheKey ?? `${type}:${Date.now()}`,
      cacheType: `${type}:${details.provider}`,
      resultJson: {
        provider: details.provider,
        model: details.model,
        inputTokens: details.inputTokens,
        outputTokens: details.outputTokens,
      },
      model: details.model,
      inputTokens: details.inputTokens,
      outputTokens: details.outputTokens,
      costUsd: estimatedCost,
    })
    .run();
}

/**
 * Record a search API usage event.
 * Search calls don't use tokens — fixed cost per call.
 * Bing: ~$0.003/search, Serper: ~$0.001/search, Exa: ~$0.001/search
 */
export function recordSearchUsage(
  provider: "bing" | "serper" | "exa",
  query: string,
): void {
  const costPerSearch = provider === "bing" ? 0.003 : 0.001;

  db.insert(analysisCache)
    .values({
      cacheKey: `search:${provider}:${Date.now()}`,
      cacheType: `search:${provider}`,
      resultJson: {
        provider,
        query,
        type: "search",
      },
      model: provider,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: costPerSearch,
    })
    .run();
}

/**
 * Get usage summary for today and all time.
 */
export function getUsageSummary(): {
  today: Record<string, { used: number; limit: number | null }>;
  allTime: {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number;
  };
} {
  const todayStart = getTodayStart();

  // Count today's usage per type
  const todayRows = db
    .select()
    .from(analysisCache)
    .where(gte(analysisCache.createdAt, todayStart))
    .all();

  const todayCounts: Record<string, number> = {};
  for (const row of todayRows) {
    todayCounts[row.cacheType] = (todayCounts[row.cacheType] ?? 0) + 1;
  }

  const today: Record<string, { used: number; limit: number | null }> = {};
  for (const [key, count] of Object.entries(todayCounts)) {
    const isOpenAI = key.includes(":openai");
    today[key] = { used: count, limit: isOpenAI ? null : 10 };
  }

  // All time totals
  const allRows = db.select().from(analysisCache).all();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;
  for (const row of allRows) {
    totalInputTokens += row.inputTokens ?? 0;
    totalOutputTokens += row.outputTokens ?? 0;
    totalCostUsd += row.costUsd ?? 0;
  }

  return {
    today,
    allTime: {
      totalCalls: allRows.length,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
    },
  };
}
