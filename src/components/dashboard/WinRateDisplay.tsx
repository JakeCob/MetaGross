"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { calculateWinRate, getStreakInfo } from "@/lib/utils/stats";

interface MatchData {
  result: string;
}

interface WinRateDisplayProps {
  matches: MatchData[];
}

export function WinRateDisplay({ matches }: WinRateDisplayProps) {
  const { wins, losses, total, winRate } = calculateWinRate(matches);
  const streak = getStreakInfo(matches);

  const winPercent = total > 0 ? (wins / total) * 100 : 0;
  const lossPercent = total > 0 ? (losses / total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Win Rate</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted">
            No match data yet. Log battles to see your win rate.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Large win rate display */}
            <div className="flex items-baseline gap-2">
              <span
                className={`text-5xl font-bold ${
                  winRate >= 50 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {winRate}%
              </span>
              <span className="text-sm text-muted">win rate</span>
            </div>

            {/* Win/Loss bar */}
            <div>
              <div className="flex h-4 w-full overflow-hidden rounded-full">
                <div
                  className="bg-emerald-500 transition-all duration-300"
                  style={{ width: `${winPercent}%` }}
                  title={`${wins} wins`}
                />
                <div
                  className="bg-red-500 transition-all duration-300"
                  style={{ width: `${lossPercent}%` }}
                  title={`${losses} losses`}
                />
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span className="text-emerald-400">{wins}W</span>
                <span className="text-red-400">{losses}L</span>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-muted">Total:</span>{" "}
                <span className="font-medium text-foreground">{total}</span>
              </div>
              {streak.currentStreak > 0 && (
                <div>
                  <span className="text-muted">Streak:</span>{" "}
                  <span
                    className={`font-medium ${
                      streak.streakType === "win"
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {streak.currentStreak}
                    {streak.streakType === "win" ? "W" : "L"}
                  </span>
                </div>
              )}
              {streak.longestWinStreak > 0 && (
                <div>
                  <span className="text-muted">Best:</span>{" "}
                  <span className="font-medium text-emerald-400">
                    {streak.longestWinStreak}W
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
