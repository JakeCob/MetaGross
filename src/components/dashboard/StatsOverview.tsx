"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  calculateWinRate,
  getStreakInfo,
  calculatePokemonUsage,
} from "@/lib/utils/stats";

interface MatchData {
  result: string;
  myBrought: string[];
  myLeads: string[];
}

interface StatsOverviewProps {
  matches: MatchData[];
}

export function StatsOverview({ matches }: StatsOverviewProps) {
  const { wins, losses, total, winRate } = calculateWinRate(matches);
  const streak = getStreakInfo(matches);
  const pokemonUsage = calculatePokemonUsage(matches);
  const topPokemon = pokemonUsage.length > 0 ? pokemonUsage[0] : null;

  const stats = [
    {
      label: "Total Matches",
      value: total.toString(),
      secondary: `${wins}W – ${losses}L`,
    },
    {
      label: "Win Rate",
      value: total > 0 ? `${winRate}%` : "--",
      secondary:
        total > 0
          ? winRate >= 50
            ? "Above average"
            : "Below average"
          : "No data",
    },
    {
      label: "Current Streak",
      value:
        streak.currentStreak > 0
          ? `${streak.currentStreak}${streak.streakType === "win" ? "W" : "L"}`
          : "--",
      secondary:
        streak.longestWinStreak > 0
          ? `Best: ${streak.longestWinStreak}W`
          : "No data",
    },
    {
      label: "Most Used Pokemon",
      value: topPokemon ? topPokemon.species : "--",
      secondary: topPokemon
        ? `${topPokemon.timesBrought} games, ${topPokemon.winRateWhenBrought}% WR`
        : "No data",
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.secondary}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
