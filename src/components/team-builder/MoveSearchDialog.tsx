"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

type FilterCategory = "All" | "Physical" | "Special" | "Status";

export interface MoveSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Slot index being filled (1-4), shown in the title. */
  slotNumber: number;
  /** Sorted list of legal moves for the species (already format-filtered). */
  legalMoveNames: string[];
  moveDataCache: Record<string, MoveData>;
  /** Names already chosen on this Pokemon — disabled in the picker. */
  alreadyChosen: string[];
  loading: boolean;
  onPick: (moveName: string) => void;
}

export function MoveSearchDialog({
  open,
  onOpenChange,
  slotNumber,
  legalMoveNames,
  moveDataCache,
  alreadyChosen,
  loading,
  onPick,
}: MoveSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FilterCategory>("All");
  const [highlight, setHighlight] = useState(0);

  // Reset filters whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setCategory("All");
      setHighlight(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = legalMoveNames.filter((name) => {
      if (q && !name.toLowerCase().includes(q)) return false;
      if (category !== "All") {
        const data = moveDataCache[name];
        if (!data || data.category !== category) return false;
      }
      return true;
    });
    return list.slice(0, 200);
  }, [legalMoveNames, moveDataCache, query, category]);

  const chosenSet = useMemo(
    () => new Set(alreadyChosen.filter(Boolean)),
    [alreadyChosen],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add move — Slot {slotNumber}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 min-h-0 flex-1">
          <Input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={(e) => {
              if (filtered.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => (h < filtered.length - 1 ? h + 1 : 0));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => (h > 0 ? h - 1 : filtered.length - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const pick = filtered[highlight];
                if (pick && !chosenSet.has(pick)) {
                  onPick(pick);
                  onOpenChange(false);
                }
              }
            }}
            placeholder={loading ? "Loading moves..." : "Search moves..."}
            disabled={loading}
            autoComplete="off"
          />

          {/* Category filter chips */}
          <div className="flex flex-wrap gap-1">
            {(["All", "Physical", "Special", "Status"] as FilterCategory[]).map(
              (c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`text-[11px] px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                    category === c
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-border/80"
                  }`}
                >
                  {c}
                </button>
              ),
            )}
            <span className="ml-auto text-[11px] text-muted-foreground self-center">
              {filtered.length} match{filtered.length === 1 ? "" : "es"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto rounded-lg border border-border/50">
            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Loading moves…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No matching moves
              </div>
            ) : (
              filtered.map((moveName, i) => {
                const data = moveDataCache[moveName];
                const isChosen = chosenSet.has(moveName);
                return (
                  <button
                    key={moveName}
                    type="button"
                    onClick={() => {
                      if (isChosen) return;
                      onPick(moveName);
                      onOpenChange(false);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    disabled={isChosen}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm border-b border-border/30 last:border-b-0 transition-colors cursor-pointer ${
                      isChosen
                        ? "opacity-40 cursor-not-allowed"
                        : i === highlight
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground hover:bg-accent/40"
                    }`}
                  >
                    <span className="flex-1 truncate font-medium">
                      {moveName}
                      {isChosen && (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          (already on set)
                        </span>
                      )}
                    </span>
                    {data && (
                      <div className="flex items-center gap-1 shrink-0">
                        {data.priority !== 0 && (
                          <span
                            className="text-[10px] text-amber-400 font-mono"
                            title={`Priority ${data.priority > 0 ? "+" : ""}${data.priority}`}
                          >
                            {data.priority > 0 ? "+" : ""}
                            {data.priority}
                          </span>
                        )}
                        <Badge
                          className={`text-[10px] px-1.5 py-0 ${
                            TYPE_COLORS[data.type] ?? "bg-gray-600 text-white"
                          }`}
                        >
                          {data.type}
                        </Badge>
                        <Badge
                          className={`text-[10px] px-1.5 py-0 ${
                            CATEGORY_STYLES[data.category] ?? ""
                          }`}
                        >
                          {data.category}
                        </Badge>
                        {data.basePower > 0 && (
                          <span className="text-[10px] text-muted-foreground font-mono w-8 text-right">
                            {data.basePower}BP
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <p className="text-[10px] text-muted-foreground">
            ↑↓ to navigate · Enter to add · Esc to close
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
