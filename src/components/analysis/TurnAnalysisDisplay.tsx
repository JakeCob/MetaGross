"use client";

import { useState } from "react";
import type { TurnAnalysis, MoveGradeResult } from "@/lib/types/analysis";
import { MoveGradeDisplay } from "./MoveGradeDisplay";
import { Badge } from "@/components/ui/badge";

interface TurnAnalysisDisplayProps {
  turnAnalysis: TurnAnalysis;
}

export function TurnAnalysisDisplay({ turnAnalysis }: TurnAnalysisDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  const { turnNumber, winProbability, isTurningPoint, moveGrades } = turnAnalysis;

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        isTurningPoint
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-border bg-card"
      }`}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            Turn {turnNumber}
          </span>
          {isTurningPoint && (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0">
              Turning Point
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Win: {winProbability}%
          </span>
          <div className="flex gap-1">
            {moveGrades.map((grade, i) => (
              <MoveGradeDisplay key={i} grade={grade.grade} />
            ))}
          </div>
          <svg
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && moveGrades.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {moveGrades.map((grade, i) => (
            <MoveGradeDetail key={i} grade={grade} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function MoveGradeDetail({
  grade,
  index,
}: {
  grade: MoveGradeResult;
  index: number;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="mt-0.5 text-xs text-muted-foreground">
        Slot {index + 1}
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <MoveGradeDisplay grade={grade.grade} reason={grade.reason} />
          {grade.winProbDelta > 0 && (
            <span className="text-xs text-muted-foreground">
              -{grade.winProbDelta.toFixed(0)}% from optimal
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{grade.reason}</p>
        {grade.grade !== "optimal" && (
          <p className="mt-0.5 text-xs text-muted-foreground/70 italic">
            {grade.optimalPlay}
          </p>
        )}
      </div>
    </div>
  );
}
