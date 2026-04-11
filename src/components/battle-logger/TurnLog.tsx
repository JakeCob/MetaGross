"use client";

import { useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import type { Turn, TurnAction } from "@/lib/types/battle";

function formatAction(action: TurnAction): string {
  const sideLabel = action.side === "p1" ? "My" : "Opp";

  if (action.actionType === "switch") {
    return `${sideLabel} slot ${action.slot}: ${action.switchOutSpecies} -> ${action.switchInSpecies}`;
  }

  if (action.actionType === "nothing") {
    return `${sideLabel} slot ${action.slot}: Did nothing`;
  }

  // move or mega_move
  const mega = action.megaEvolved ? " (Mega)" : "";
  const movePart = `${action.moveName}${mega}`;
  const targetLabel = action.targetSide === "p1" ? "my" : "opp";
  const dmg = action.damageDealtPercent != null ? ` ${action.damageDealtPercent}%` : "";
  const crit = action.wasCriticalHit ? " CRIT" : "";
  const ko = action.wasKo ? " KO!" : "";
  return `${sideLabel} slot ${action.slot}: ${movePart} -> ${targetLabel} slot ${action.targetSlot}${dmg}${crit}${ko}`;
}

export interface TurnLogProps {
  turns: Turn[];
  currentTurnActions: TurnAction[];
  currentTurn: number;
}

export function TurnLog({
  turns,
  currentTurnActions,
  currentTurn,
}: TurnLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, currentTurnActions.length]);

  return (
    <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-card">
      {turns.length === 0 && currentTurnActions.length === 0 && (
        <div className="flex items-center justify-center py-6">
          <span className="text-xs text-muted-foreground">No turns logged yet</span>
        </div>
      )}

      <div className="divide-y divide-border">
        {/* Completed turns */}
        {turns.map((turn) => (
          <div key={turn.number} className="px-3 py-2">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                T{turn.number}
              </Badge>
              {turn.fieldState.weather && (
                <span className="text-[10px] text-warning">
                  {turn.fieldState.weather}
                </span>
              )}
              {turn.fieldState.terrain && (
                <span className="text-[10px] text-info">
                  {turn.fieldState.terrain}
                </span>
              )}
              {turn.fieldState.trickRoom && (
                <span className="text-[10px] text-warning">TR</span>
              )}
            </div>
            <div className="space-y-0.5">
              {turn.actions.map((action, i) => (
                <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                  {formatAction(action)}
                </p>
              ))}
              {turn.actions.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No actions recorded</p>
              )}
            </div>
          </div>
        ))}

        {/* Current turn in progress */}
        {currentTurnActions.length > 0 && (
          <div className="px-3 py-2 bg-accent/5">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="info" className="text-[10px] px-1.5 py-0">
                T{currentTurn}
              </Badge>
              <span className="text-[10px] text-muted-foreground italic">in progress</span>
            </div>
            <div className="space-y-0.5">
              {currentTurnActions.map((action, i) => (
                <p key={i} className="text-xs text-foreground leading-relaxed">
                  {formatAction(action)}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
