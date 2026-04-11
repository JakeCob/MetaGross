"use client";

import type { EVSpread, StatName } from "@/lib/types/pokemon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STAT_LABELS: { key: StatName; label: string }[] = [
  { key: "hp", label: "HP" },
  { key: "atk", label: "Atk" },
  { key: "def", label: "Def" },
  { key: "spa", label: "SpA" },
  { key: "spd", label: "SpD" },
  { key: "spe", label: "Spe" },
];

export interface SpreadComparisonProps {
  current: EVSpread;
  suggested: EVSpread;
  currentNature: string;
  suggestedNature: string;
}

export function SpreadComparison({
  current,
  suggested,
  currentNature,
  suggestedNature,
}: SpreadComparisonProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spread Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {/* Nature row */}
          <div className="grid grid-cols-[3rem_1fr_1fr] gap-2 items-center">
            <span className="text-xs text-muted-foreground">Nature</span>
            <div className="text-center">
              <span className="text-xs font-medium text-foreground">
                {currentNature}
              </span>
            </div>
            <div className="text-center">
              <span
                className={`text-xs font-medium ${
                  suggestedNature !== currentNature
                    ? "text-blue-400"
                    : "text-foreground"
                }`}
              >
                {suggestedNature}
              </span>
            </div>
          </div>

          {/* Header */}
          <div className="grid grid-cols-[3rem_1fr_1fr] gap-2 items-center">
            <span className="text-[10px] text-muted-foreground">Stat</span>
            <span className="text-[10px] text-muted-foreground text-center">
              Current
            </span>
            <span className="text-[10px] text-muted-foreground text-center">
              Suggested
            </span>
          </div>

          {/* Stat rows */}
          {STAT_LABELS.map(({ key, label }) => {
            const curVal = current[key];
            const sugVal = suggested[key];
            const diff = sugVal - curVal;
            const maxVal = 252;

            return (
              <div
                key={key}
                className="grid grid-cols-[3rem_1fr_1fr] gap-2 items-center"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {label}
                </span>

                {/* Current bar */}
                <div className="flex flex-col gap-0.5">
                  <div className="h-2.5 w-full rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/40 transition-all"
                      style={{ width: `${(curVal / maxVal) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-center text-muted-foreground">
                    {curVal}
                  </span>
                </div>

                {/* Suggested bar */}
                <div className="flex flex-col gap-0.5">
                  <div className="h-2.5 w-full rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${
                        diff > 0
                          ? "bg-green-500"
                          : diff < 0
                            ? "bg-red-500"
                            : "bg-foreground/40"
                      }`}
                      style={{ width: `${(sugVal / maxVal) * 100}%` }}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-mono text-center ${
                      diff > 0
                        ? "text-green-500"
                        : diff < 0
                          ? "text-red-500"
                          : "text-muted-foreground"
                    }`}
                  >
                    {sugVal}
                    {diff !== 0 && (
                      <span className="ml-0.5">
                        ({diff > 0 ? "+" : ""}
                        {diff})
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Total */}
          <div className="grid grid-cols-[3rem_1fr_1fr] gap-2 items-center border-t border-border pt-2">
            <span className="text-xs font-medium text-muted-foreground">
              Total
            </span>
            <span className="text-xs font-mono text-center text-muted-foreground">
              {STAT_LABELS.reduce((sum, s) => sum + current[s.key], 0)}
            </span>
            <span className="text-xs font-mono text-center text-muted-foreground">
              {STAT_LABELS.reduce((sum, s) => sum + suggested[s.key], 0)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
