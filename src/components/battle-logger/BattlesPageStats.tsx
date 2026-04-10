"use client";

import { use } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { calculateWinRate } from "@/lib/utils/stats";

async function fetchStats() {
  const res = await fetch("/api/matches");
  if (!res.ok) return null;
  const data = await res.json();
  const raw = (data.matches ?? []) as Record<string, unknown>[];
  const matches = raw
    .filter((m) => typeof m.result === "string")
    .map((m) => ({ result: m.result as string }));
  return calculateWinRate(matches);
}

let statsPromise: ReturnType<typeof fetchStats> | null = null;

function getStatsPromise() {
  if (!statsPromise) {
    statsPromise = fetchStats();
  }
  return statsPromise;
}

export function BattlesPageStats() {
  const stats = use(getStatsPromise());

  if (!stats || stats.total === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">
            Total Matches
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {stats.total}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">
            Win Rate
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${
              stats.winRate >= 50 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {stats.winRate}%
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">
            Record
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            <span className="text-emerald-400">{stats.wins}</span>
            {" - "}
            <span className="text-red-400">{stats.losses}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
