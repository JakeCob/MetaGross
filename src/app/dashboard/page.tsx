"use client";

import { useState, useEffect, useCallback } from "react";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { WinRateDisplay } from "@/components/dashboard/WinRateDisplay";
import { PokemonUsageTable } from "@/components/dashboard/PokemonUsageTable";
import { RecentMatches } from "@/components/dashboard/RecentMatches";

interface MatchData {
  id: string;
  result: string;
  playedAt: number | null;
  opponentName: string | null;
  myBrought: string[];
  myLeads: string[];
  opponentLeads: string[];
  archetypeOpponent: string | null;
}

function parseMatch(raw: Record<string, unknown>): MatchData {
  return {
    id: raw.id as string,
    result: (raw.result as string) ?? "loss",
    playedAt: (raw.playedAt as number) ?? null,
    opponentName: (raw.opponentName as string) ?? null,
    myBrought: Array.isArray(raw.myBrought) ? (raw.myBrought as string[]) : [],
    myLeads: Array.isArray(raw.myLeads) ? (raw.myLeads as string[]) : [],
    opponentLeads: Array.isArray(raw.opponentLeads)
      ? (raw.opponentLeads as string[])
      : [],
    archetypeOpponent: (raw.archetypeOpponent as string) ?? null,
  };
}

export default function DashboardPage() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/matches");
      if (!res.ok) throw new Error("Failed to fetch matches");
      const data = await res.json();
      const raw = (data.matches ?? []) as Record<string, unknown>[];
      setMatches(raw.map(parseMatch));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted">Your VGC performance at a glance.</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-muted">Loading dashboard...</span>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={fetchMatches}
            className="mt-2 text-sm text-accent hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-6">
          <StatsOverview matches={matches} />

          <div className="grid gap-6 lg:grid-cols-2">
            <WinRateDisplay matches={matches} />
            <RecentMatches matches={matches} />
          </div>

          <PokemonUsageTable matches={matches} />
        </div>
      )}
    </div>
  );
}
