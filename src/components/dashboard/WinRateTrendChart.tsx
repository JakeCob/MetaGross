"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { calculateRollingWinRate } from "@/lib/utils/stats";

interface MatchData {
  result: string;
}

interface WinRateTrendChartProps {
  matches: MatchData[];
}

const WINDOW = 10;

export function WinRateTrendChart({ matches }: WinRateTrendChartProps) {
  const data = useMemo(
    () => calculateRollingWinRate(matches, WINDOW),
    [matches],
  );

  if (matches.length < WINDOW) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Win Rate Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Play at least {WINDOW} matches to see your rolling win rate trend.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Win Rate Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
            >
              <defs>
                <linearGradient id="winRateGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <ReferenceLine
                y={50}
                stroke="var(--color-muted-foreground)"
                strokeDasharray="6 4"
                strokeOpacity={0.5}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "var(--color-foreground)",
                }}
                labelStyle={{ color: "var(--color-muted-foreground)", marginBottom: 4 }}
                formatter={(value) => [`${value}%`, "Win Rate"]}
              />
              <Area
                type="monotone"
                dataKey="winRate"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#winRateGradient)"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#3b82f6",
                  stroke: "var(--color-card)",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Rolling win rate over the last {WINDOW} matches
        </p>
      </CardContent>
    </Card>
  );
}
