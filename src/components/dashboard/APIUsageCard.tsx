"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface UsageSummary {
  today: Record<string, { used: number; limit: number | null }>;
  allTime: {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number;
  };
}

interface ProviderRow {
  label: string;
  key: string;
  used: number;
  limit: number | null;
}

function getBarColor(used: number, limit: number): string {
  const ratio = used / limit;
  if (ratio >= 1) return "bg-red-500";
  if (ratio >= 0.7) return "bg-yellow-500";
  return "bg-emerald-500";
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/**
 * Aggregate today's usage into a friendly provider-based list.
 */
function buildProviderRows(
  today: Record<string, { used: number; limit: number | null }>,
): ProviderRow[] {
  // Known providers to display (even if 0 usage today)
  const providers: { label: string; matchKey: string; limit: number | null }[] =
    [
      { label: "OpenAI", matchKey: "openai", limit: null },
      { label: "OpenRouter", matchKey: "openrouter", limit: 10 },
      { label: "Serper", matchKey: "serper", limit: 10 },
      { label: "Exa", matchKey: "exa", limit: 10 },
    ];

  return providers.map((p) => {
    // Sum all usage keys that contain this provider
    let totalUsed = 0;
    for (const [key, val] of Object.entries(today)) {
      if (key.includes(`:${p.matchKey}`)) {
        totalUsed += val.used;
      }
    }
    return {
      label: p.label,
      key: p.matchKey,
      used: totalUsed,
      limit: p.limit,
    };
  });
}

export function APIUsageCard() {
  const [data, setData] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchUsage() {
      try {
        const res = await fetch("/api/usage");
        if (!res.ok) throw new Error("Failed to fetch usage");
        const json = (await res.json()) as UsageSummary;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load usage");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchUsage();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Usage</CardTitle>
        <CardDescription>
          Daily rate limits and all-time usage tracking
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <p className="text-sm text-muted-foreground">Loading usage data...</p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {data && !loading && (
          <div className="flex flex-col gap-6">
            {/* Today's usage */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Today
              </h3>
              <div className="flex flex-col gap-3">
                {buildProviderRows(data.today).map((row) => (
                  <div key={row.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{row.label}</span>
                      <span className="text-muted-foreground">
                        {row.used}
                        {row.limit != null
                          ? ` / ${row.limit} calls`
                          : " calls (no limit)"}
                      </span>
                    </div>
                    {row.limit != null ? (
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${getBarColor(row.used, row.limit)}`}
                          style={{
                            width: `${Math.min(100, (row.used / row.limit) * 100)}%`,
                          }}
                        />
                      </div>
                    ) : (
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500/40"
                          style={{ width: row.used > 0 ? "100%" : "0%" }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* All-time totals */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                All Time
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                  <p className="text-lg font-bold">
                    {data.allTime.totalCalls}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Input Tokens</p>
                  <p className="text-lg font-bold">
                    {formatTokens(data.allTime.totalInputTokens)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Output Tokens</p>
                  <p className="text-lg font-bold">
                    {formatTokens(data.allTime.totalOutputTokens)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Estimated Cost
                  </p>
                  <p className="text-lg font-bold">
                    ${data.allTime.totalCostUsd.toFixed(4)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
