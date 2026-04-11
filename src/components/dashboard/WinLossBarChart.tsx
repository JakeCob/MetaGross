"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent, CardAction } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateWinRateByPeriod } from "@/lib/utils/stats";

interface MatchData {
  result: string;
  playedAt: number | null;
}

interface WinLossBarChartProps {
  matches: MatchData[];
}

type Period = "day" | "week" | "month";

function formatPeriodLabel(raw: string, period: Period): string {
  if (period === "day") {
    // YYYY-MM-DD -> MM/DD
    const parts = raw.split("-");
    return `${parts[1]}/${parts[2]}`;
  }
  if (period === "week") {
    // W2024-01-01 -> W 01/01
    const dateStr = raw.slice(1);
    const parts = dateStr.split("-");
    return `W ${parts[1]}/${parts[2]}`;
  }
  if (period === "month") {
    // YYYY-MM -> MMM YY
    const [year, month] = raw.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(month, 10) - 1]} '${year.slice(2)}`;
  }
  return raw;
}

export function WinLossBarChart({ matches }: WinLossBarChartProps) {
  const [period, setPeriod] = useState<Period>("week");

  const validMatches = useMemo(
    () =>
      matches
        .filter((m): m is { result: string; playedAt: number } => m.playedAt !== null),
    [matches],
  );

  const data = useMemo(
    () =>
      calculateWinRateByPeriod(validMatches, period).map((d) => ({
        ...d,
        displayPeriod: formatPeriodLabel(d.period, period),
      })),
    [validMatches, period],
  );

  if (validMatches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Wins &amp; Losses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No match data with dates available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wins &amp; Losses</CardTitle>
        <CardAction>
          <Tabs defaultValue="week" onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
              barGap={2}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                vertical={false}
              />
              <XAxis
                dataKey="displayPeriod"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
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
                cursor={{ fill: "var(--color-border)", opacity: 0.3 }}
              />
              <Bar dataKey="wins" name="Wins" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {data.map((_, i) => (
                  <Cell key={i} fill="#22c55e" />
                ))}
              </Bar>
              <Bar dataKey="losses" name="Losses" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {data.map((_, i) => (
                  <Cell key={i} fill="#ef4444" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
