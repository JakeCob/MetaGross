"use client";

import { useState, useEffect, useCallback } from "react";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { WinRateDisplay } from "@/components/dashboard/WinRateDisplay";
import { WinRateTrendChart } from "@/components/dashboard/WinRateTrendChart";
import { WinLossBarChart } from "@/components/dashboard/WinLossBarChart";
import { MatchupHeatmap } from "@/components/dashboard/MatchupHeatmap";
import { MoveQualityChart } from "@/components/dashboard/MoveQualityChart";
import { PokemonUsageTable } from "@/components/dashboard/PokemonUsageTable";
import { RecentMatches } from "@/components/dashboard/RecentMatches";
import { APIUsageCard } from "@/components/dashboard/APIUsageCard";

interface MatchData {
  id: string;
  result: string;
  playedAt: number | null;
  opponentName: string | null;
  myBrought: string[];
  myLeads: string[];
  opponentLeads: string[];
  archetypeOpponent: string | null;
  ruleAnalysis?: {
    moveGrading?: {
      optimal?: number;
      good?: number;
      inaccuracy?: number;
      mistake?: number;
      blunder?: number;
    };
  } | null;
}

function parseMatch(raw: Record<string, unknown>): MatchData {
  const ruleAnalysisRaw = raw.ruleAnalysis as Record<string, unknown> | null | undefined;
  let ruleAnalysis: MatchData["ruleAnalysis"] = null;
  if (ruleAnalysisRaw && typeof ruleAnalysisRaw === "object") {
    const mg = ruleAnalysisRaw.moveGrading as Record<string, unknown> | undefined;
    if (mg && typeof mg === "object") {
      ruleAnalysis = {
        moveGrading: {
          optimal: typeof mg.optimal === "number" ? mg.optimal : undefined,
          good: typeof mg.good === "number" ? mg.good : undefined,
          inaccuracy: typeof mg.inaccuracy === "number" ? mg.inaccuracy : undefined,
          mistake: typeof mg.mistake === "number" ? mg.mistake : undefined,
          blunder: typeof mg.blunder === "number" ? mg.blunder : undefined,
        },
      };
    }
  }

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
    ruleAnalysis,
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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Your VGC performance at a glance.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-muted-foreground">Loading dashboard...</span>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={fetchMatches}
            className="mt-2 text-sm text-primary hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-6">
          {/* Row 1: Stat cards */}
          <StatsOverview matches={matches} />

          {/* Row 2: Win rate trend (full width) */}
          <WinRateTrendChart matches={matches} />

          {/* Row 3: Win/Loss bar chart + Matchup heatmap */}
          <div className="grid gap-6 lg:grid-cols-2">
            <WinLossBarChart matches={matches} />
            <MatchupHeatmap matches={matches} />
          </div>

          {/* Row 4: Win rate summary + Move quality */}
          <div className="grid gap-6 lg:grid-cols-2">
            <WinRateDisplay matches={matches} />
            <MoveQualityChart matches={matches} />
          </div>

          {/* Row 5: Pokemon usage + Recent matches */}
          <div className="grid gap-6 lg:grid-cols-2">
            <PokemonUsageTable matches={matches} />
            <RecentMatches matches={matches} />
          </div>

          {/* Row 6: API Usage */}
          <APIUsageCard />
        </div>
      )}
    </div>
  );
}
