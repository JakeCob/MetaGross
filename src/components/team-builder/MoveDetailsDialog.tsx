"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MoveData } from "@/lib/pokemon/moves";

const TYPE_COLORS: Record<string, string> = {
  Normal: "bg-gray-500 text-white",
  Fire: "bg-orange-600 text-white",
  Water: "bg-blue-500 text-white",
  Electric: "bg-yellow-400 text-black",
  Grass: "bg-green-500 text-white",
  Ice: "bg-cyan-300 text-black",
  Fighting: "bg-red-700 text-white",
  Poison: "bg-purple-600 text-white",
  Ground: "bg-amber-700 text-white",
  Flying: "bg-indigo-300 text-black",
  Psychic: "bg-pink-500 text-white",
  Bug: "bg-lime-600 text-white",
  Rock: "bg-yellow-800 text-white",
  Ghost: "bg-purple-800 text-white",
  Dragon: "bg-violet-700 text-white",
  Dark: "bg-gray-800 text-white",
  Steel: "bg-gray-400 text-black",
  Fairy: "bg-pink-300 text-black",
};

const CATEGORY_STYLES: Record<string, string> = {
  Physical: "bg-red-900/60 text-red-300 border-red-700/50",
  Special: "bg-blue-900/60 text-blue-300 border-blue-700/50",
  Status: "bg-gray-700/60 text-gray-300 border-gray-600/50",
};

// Doubles-friendly target labels.
const TARGET_LABELS: Record<string, string> = {
  normal: "Single target",
  any: "Any single target",
  adjacentFoe: "Single adjacent foe",
  adjacentAlly: "Single adjacent ally",
  adjacentAllyOrSelf: "Adjacent ally or self",
  allAdjacentFoes: "All adjacent foes (spread)",
  allAdjacent: "All adjacent (spread)",
  allyTeam: "Whole team",
  allySide: "Your side",
  foeSide: "Foe's side",
  all: "Whole field",
  self: "User",
  randomNormal: "Random foe",
  scripted: "Scripted target",
  allies: "All allies",
};

function priorityLabel(p: number): string {
  if (p === 0) return "Normal (0)";
  if (p > 0) return `+${p} (faster than normal)`;
  return `${p} (slower than normal)`;
}

export interface MoveDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  move: MoveData | null;
  /** When provided, shows a remove button. */
  onRemove?: () => void;
}

export function MoveDetailsDialog({
  open,
  onOpenChange,
  move,
  onRemove,
}: MoveDetailsDialogProps) {
  if (!move) return null;

  const targetLabel = TARGET_LABELS[move.target] ?? move.target;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{move.name}</span>
            <Badge
              className={`text-[10px] px-1.5 py-0 ${
                TYPE_COLORS[move.type] ?? "bg-gray-600 text-white"
              }`}
            >
              {move.type}
            </Badge>
            <Badge
              className={`text-[10px] px-1.5 py-0 ${
                CATEGORY_STYLES[move.category] ?? ""
              }`}
            >
              {move.category}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Stat grid */}
          <div className="grid grid-cols-3 gap-2">
            <Stat
              label="Base Power"
              value={move.basePower > 0 ? String(move.basePower) : "—"}
            />
            <Stat label="PP" value={String(move.pp)} />
            <Stat
              label="Priority"
              value={priorityLabel(move.priority)}
              highlight={move.priority !== 0}
            />
          </div>

          {/* Target */}
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
              Target
            </div>
            <div className="text-sm text-foreground">{targetLabel}</div>
          </div>

          {/* Description */}
          {move.description && (
            <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                Effect
              </div>
              <p className="text-sm text-foreground leading-snug">
                {move.description}
              </p>
            </div>
          )}

          {onRemove && (
            <Button
              variant="outline"
              className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/40"
              onClick={() => {
                onRemove();
                onOpenChange(false);
              }}
            >
              Remove from moveset
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border/50 bg-card px-2 py-2">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={`text-sm font-mono font-medium mt-0.5 text-center ${
          highlight ? "text-amber-400" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
