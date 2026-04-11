"use client";

import type { MatchAnalysis } from "@/lib/types/analysis";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface MatchSummaryProps {
  analysis: MatchAnalysis;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-400";
  if (score >= 75) return "text-blue-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Average";
  if (score >= 40) return "Below Average";
  return "Poor";
}

function getScoreRingColor(score: number): string {
  if (score >= 90) return "stroke-green-400";
  if (score >= 75) return "stroke-blue-400";
  if (score >= 60) return "stroke-yellow-400";
  if (score >= 40) return "stroke-orange-400";
  return "stroke-red-400";
}

export function MatchSummary({ analysis }: MatchSummaryProps) {
  const { overallScore, summary, turningPoints } = analysis;

  const gradeSegments = [
    { label: "Optimal", count: summary.optimalCount, color: "bg-green-500" },
    { label: "Good", count: summary.goodCount, color: "bg-blue-500" },
    { label: "Inaccuracy", count: summary.inaccuracyCount, color: "bg-yellow-500" },
    { label: "Mistake", count: summary.mistakeCount, color: "bg-orange-500" },
    { label: "Blunder", count: summary.blunderCount, color: "bg-red-500" },
  ];

  const totalMoves = summary.totalMoves || 1;

  // SVG ring chart parameters
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (overallScore / 100) * circumference;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Match Quality</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Score ring */}
          <div className="relative flex-shrink-0">
            <svg width="100" height="100" viewBox="0 0 100 100">
              {/* Background ring */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="8"
                opacity={0.3}
              />
              {/* Score ring */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                className={getScoreRingColor(overallScore)}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
                {overallScore}
              </span>
            </div>
          </div>

          {/* Score details */}
          <div className="flex-1 space-y-2">
            <div>
              <span className={`text-lg font-semibold ${getScoreColor(overallScore)}`}>
                {getScoreLabel(overallScore)}
              </span>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>{summary.totalMoves} moves</span>
              <span>{turningPoints.length} turning point{turningPoints.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>

        {/* Grade distribution bar */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Grade Distribution
          </p>
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            {gradeSegments.map((seg) => {
              const width = (seg.count / totalMoves) * 100;
              if (width === 0) return null;
              return (
                <div
                  key={seg.label}
                  className={`${seg.color} transition-all`}
                  style={{ width: `${width}%` }}
                  title={`${seg.label}: ${seg.count}`}
                />
              );
            })}
          </div>
        </div>

        {/* Grade counts */}
        <div className="mt-3 grid grid-cols-5 gap-1 text-center">
          {gradeSegments.map((seg) => (
            <div key={seg.label} className="space-y-0.5">
              <div
                className={`mx-auto h-2 w-2 rounded-full ${seg.color}`}
              />
              <p className="text-xs font-medium text-foreground">{seg.count}</p>
              <p className="text-[10px] text-muted-foreground">{seg.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
