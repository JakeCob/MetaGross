"use client";

import type { EVPrediction } from "@/lib/types/ev";
import type { StatName } from "@/lib/types/pokemon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STAT_LABELS: { key: StatName; label: string; color: string }[] = [
  { key: "hp", label: "HP", color: "bg-green-500" },
  { key: "atk", label: "Atk", color: "bg-red-500" },
  { key: "def", label: "Def", color: "bg-amber-500" },
  { key: "spa", label: "SpA", color: "bg-blue-500" },
  { key: "spd", label: "SpD", color: "bg-emerald-500" },
  { key: "spe", label: "Spe", color: "bg-pink-500" },
];

function confidenceLevel(confidence: number): {
  label: string;
  variant: "error" | "warning" | "success";
} {
  if (confidence < 40) return { label: "LOW", variant: "error" };
  if (confidence < 70) return { label: "MEDIUM", variant: "warning" };
  return { label: "HIGH", variant: "success" };
}

function confidenceBarColor(confidence: number): string {
  if (confidence < 40) return "bg-red-500";
  if (confidence < 70) return "bg-amber-500";
  return "bg-green-500";
}

export interface EVPredictionDisplayProps {
  prediction: EVPrediction;
}

export function EVPredictionDisplay({ prediction }: EVPredictionDisplayProps) {
  const { label, variant } = confidenceLevel(prediction.confidence);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>EV Prediction</CardTitle>
          <Badge variant={variant}>{label}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {/* Confidence meter */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Confidence</span>
              <span className="font-mono">{prediction.confidence}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${confidenceBarColor(prediction.confidence)}`}
                style={{ width: `${prediction.confidence}%` }}
              />
            </div>
          </div>

          {/* Predicted nature */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Nature:</span>
            <span className="text-sm font-medium text-foreground">
              {prediction.predictedNature}
            </span>
          </div>

          {/* EV stat bars */}
          <div className="flex flex-col gap-2">
            {STAT_LABELS.map(({ key, label: statLabel, color }) => {
              const value = prediction.predictedEvs[key] ?? 0;
              const pct = (value / 252) * 100;

              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-8 text-right text-xs font-medium text-muted-foreground shrink-0">
                    {statLabel}
                  </span>
                  <div className="h-3 flex-1 rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-mono text-foreground shrink-0">
                    {value}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Matched meta spread */}
          {prediction.matchedSpread && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Matches meta spread
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {prediction.matchedSpread.usagePercent.toFixed(1)}% usage
                </Badge>
              </div>
              <span className="text-xs font-mono text-foreground">
                {prediction.matchedSpread.nature}{" "}
                {Object.entries(prediction.matchedSpread.evs)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => `${v} ${k.toUpperCase()}`)
                  .join(" / ")}
              </span>
            </div>
          )}

          {/* Observation count */}
          <p className="text-xs text-muted-foreground">
            Based on {prediction.observations} observation
            {prediction.observations !== 1 ? "s" : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
