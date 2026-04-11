"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { calculateArchetypeMatchups } from "@/lib/utils/stats";

interface MatchData {
  archetypeOpponent?: string | null;
  result: string;
}

interface MatchupHeatmapProps {
  matches: MatchData[];
}

function winRateColor(wr: number): string {
  if (wr > 60) return "bg-emerald-500/20 text-emerald-400";
  if (wr >= 40) return "bg-yellow-500/20 text-yellow-400";
  return "bg-red-500/20 text-red-400";
}

export function MatchupHeatmap({ matches }: MatchupHeatmapProps) {
  const matchups = useMemo(() => {
    const filtered = matches
      .filter((m) => m.archetypeOpponent)
      .map((m) => ({
        archetypeOpponent: m.archetypeOpponent as string,
        result: m.result,
      }));
    return calculateArchetypeMatchups(filtered)
      .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));
  }, [matches]);

  if (matchups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Archetype Matchups</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tag opponent archetypes in your matches to see matchup data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Archetype Matchups</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Archetype
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  W
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  L
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Win Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {matchups.map((m) => (
                <tr
                  key={m.archetype}
                  className="border-b border-border/50 transition-colors hover:bg-border/20"
                >
                  <td className="px-3 py-2 font-medium text-foreground">
                    {m.archetype}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-400">
                    {m.wins}
                  </td>
                  <td className="px-3 py-2 text-right text-red-400">
                    {m.losses}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">
                    {m.wins + m.losses}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${winRateColor(m.winRate)}`}
                    >
                      {m.winRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
