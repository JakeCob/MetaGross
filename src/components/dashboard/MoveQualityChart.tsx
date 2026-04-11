"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface MoveGrading {
  optimal?: number;
  good?: number;
  inaccuracy?: number;
  mistake?: number;
  blunder?: number;
}

interface MatchData {
  id: string;
  playedAt?: number | null;
  opponentName?: string | null;
  ruleAnalysis?: {
    moveGrading?: MoveGrading;
  } | null;
}

interface MoveQualityChartProps {
  matches: MatchData[];
}

const GRADE_COLORS: Record<string, string> = {
  optimal: "#22c55e",
  good: "#3b82f6",
  inaccuracy: "#eab308",
  mistake: "#f97316",
  blunder: "#ef4444",
};

const GRADE_LABELS: Record<string, string> = {
  optimal: "Optimal",
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

export function MoveQualityChart({ matches }: MoveQualityChartProps) {
  const data = useMemo(() => {
    const analyzed = matches
      .filter((m) => m.ruleAnalysis?.moveGrading)
      .slice(0, 20); // last 20 analyzed matches

    return analyzed.map((m, idx) => {
      const g = m.ruleAnalysis!.moveGrading!;
      const total =
        (g.optimal ?? 0) +
        (g.good ?? 0) +
        (g.inaccuracy ?? 0) +
        (g.mistake ?? 0) +
        (g.blunder ?? 0);

      if (total === 0) {
        return {
          label: m.opponentName ? `vs ${m.opponentName}` : `#${idx + 1}`,
          optimal: 0,
          good: 0,
          inaccuracy: 0,
          mistake: 0,
          blunder: 0,
        };
      }

      return {
        label: m.opponentName ? `vs ${m.opponentName}` : `#${idx + 1}`,
        optimal: Math.round(((g.optimal ?? 0) / total) * 100),
        good: Math.round(((g.good ?? 0) / total) * 100),
        inaccuracy: Math.round(((g.inaccuracy ?? 0) / total) * 100),
        mistake: Math.round(((g.mistake ?? 0) / total) * 100),
        blunder: Math.round(((g.blunder ?? 0) / total) * 100),
      };
    });
  }, [matches]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Move Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Analyze your matches to see move quality grading over time.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Move Quality</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
              stackOffset="expand"
            >
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
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
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
                formatter={(value, name) => [
                  `${value}%`,
                  GRADE_LABELS[name as string] ?? name,
                ]}
              />
              {(["optimal", "good", "inaccuracy", "mistake", "blunder"] as const).map(
                (grade) => (
                  <Bar
                    key={grade}
                    dataKey={grade}
                    name={grade}
                    stackId="quality"
                    fill={GRADE_COLORS[grade]}
                  />
                ),
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3">
          {Object.entries(GRADE_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: GRADE_COLORS[key] }}
              />
              {label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
