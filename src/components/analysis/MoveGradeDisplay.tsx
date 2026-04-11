"use client";

import type { MoveGrade } from "@/lib/types/analysis";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface MoveGradeDisplayProps {
  grade: MoveGrade;
  reason?: string;
}

const gradeConfig: Record<
  MoveGrade,
  { label: string; className: string }
> = {
  optimal: {
    label: "Optimal",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  good: {
    label: "Good",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  inaccuracy: {
    label: "Inaccuracy",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  mistake: {
    label: "Mistake",
    className: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  },
  blunder: {
    label: "Blunder",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
  },
};

export function MoveGradeDisplay({ grade, reason }: MoveGradeDisplayProps) {
  const config = gradeConfig[grade];
  const badge = (
    <Badge
      className={`text-xs font-semibold border ${config.className}`}
    >
      {config.label}
    </Badge>
  );

  if (!reason) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
