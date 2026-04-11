"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface TurnControlsProps {
  currentTurn: number;
  canCommit: boolean;
  canUndo: boolean;
  onCommit: () => void;
  onUndo: () => void;
  actionsCount: number;
}

export function TurnControls({
  currentTurn,
  canCommit,
  canUndo,
  onCommit,
  onUndo,
  actionsCount,
}: TurnControlsProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <Badge variant="info" className="text-xs px-2 py-0.5">
          Turn {currentTurn}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {actionsCount} action{actionsCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
        >
          Undo
        </Button>
        <Button
          size="sm"
          onClick={onCommit}
          disabled={!canCommit}
        >
          End Turn
        </Button>
      </div>
    </div>
  );
}
