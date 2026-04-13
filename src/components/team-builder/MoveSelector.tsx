"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { MoveDetailsDialog } from "./MoveDetailsDialog";
import { MoveSearchDialog } from "./MoveSearchDialog";
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

export interface MoveSelectorProps {
  species: string;
  value: [string, string, string, string];
  onChange: (moves: [string, string, string, string]) => void;
  /** Restrict the pool to moves legal in Champions Reg M-A (e.g., no Tera Blast). */
  championsOnly?: boolean;
}

// Moves disallowed in Champions Reg M-A (Terastallization is disabled).
const CHAMPIONS_BANNED_MOVES = new Set<string>(["Tera Blast", "Tera Starstorm"]);

export function MoveSelector({
  species,
  value,
  onChange,
  championsOnly = false,
}: MoveSelectorProps) {
  const [legalMoveNames, setLegalMoveNames] = useState<string[]>([]);
  const [moveDataCache, setMoveDataCache] = useState<Record<string, MoveData>>({});
  const [loading, setLoading] = useState(false);
  const [detailMove, setDetailMove] = useState<{ name: string; index: number } | null>(null);
  const [searchSlot, setSearchSlot] = useState<number | null>(null);

  // Fetch legal moves when species changes
  useEffect(() => {
    if (!species) {
      setLegalMoveNames([]);
      setMoveDataCache({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/pokemon/${encodeURIComponent(species)}/moves?detail=true`)
      .then((res) => res.json())
      .then((result: { names: string[]; data: Record<string, MoveData> }) => {
        if (cancelled) return;
        const names = championsOnly
          ? result.names.filter((n) => !CHAMPIONS_BANNED_MOVES.has(n))
          : result.names;
        setLegalMoveNames(names);
        setMoveDataCache(result.data);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLegalMoveNames([]);
          setMoveDataCache({});
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [species, championsOnly]);

  const handlePickMoveForSlot = useCallback(
    (slotIndex: number, moveName: string) => {
      if (value.includes(moveName)) return; // duplicate guard
      const newMoves = [...value] as [string, string, string, string];
      newMoves[slotIndex] = moveName;
      onChange(newMoves);
    },
    [value, onChange],
  );

  const handleRemoveMove = useCallback(
    (index: number) => {
      const newMoves = [...value] as [string, string, string, string];
      newMoves[index] = "";
      onChange(newMoves);
    },
    [value, onChange],
  );

  const filledCount = value.filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-medium text-foreground">
        Moves ({filledCount}/4)
      </div>

      {/* Move slots */}
      <div className="grid grid-cols-2 gap-2">
        {value.map((moveName, i) => {
          const moveData = moveName ? moveDataCache[moveName] : null;
          return (
            <div key={i}>
              {moveName ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailMove({ name: moveName, index: i })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDetailMove({ name: moveName, index: i });
                    }
                  }}
                  className="group/move flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-left transition-colors hover:border-primary/60 hover:bg-accent/30 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title="Click for move details"
                >
                  <span className="flex-1 font-medium truncate">
                    {moveName}
                  </span>
                  {moveData && (
                    <div className="flex items-center gap-1 shrink-0">
                      {moveData.priority !== 0 && (
                        <span
                          className="text-[10px] font-mono text-amber-400"
                          title={`Priority ${moveData.priority > 0 ? "+" : ""}${moveData.priority}`}
                        >
                          {moveData.priority > 0 ? "+" : ""}
                          {moveData.priority}
                        </span>
                      )}
                      <Badge
                        className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[moveData.type] ?? "bg-gray-600 text-white"}`}
                      >
                        {moveData.type}
                      </Badge>
                      <Badge
                        className={`text-[10px] px-1.5 py-0 ${CATEGORY_STYLES[moveData.category] ?? ""}`}
                      >
                        {moveData.category}
                      </Badge>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveMove(i);
                    }}
                    className="ml-1 -mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
                    aria-label={`Remove ${moveName}`}
                    title="Remove move"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!species || loading}
                  onClick={() => setSearchSlot(i)}
                  className="flex h-[38px] w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground transition-colors cursor-pointer hover:border-primary/60 hover:bg-accent/20 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  title={
                    !species
                      ? "Pick a Pokemon first"
                      : loading
                        ? "Loading moves…"
                        : `Add a move to slot ${i + 1}`
                  }
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 12h14" />
                    <path d="M12 5v14" />
                  </svg>
                  <span>{loading ? "Loading…" : `Slot ${i + 1}`}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Click a slot to search moves · click a filled move for details · × to remove
      </p>

      <MoveSearchDialog
        open={searchSlot !== null}
        onOpenChange={(o) => {
          if (!o) setSearchSlot(null);
        }}
        slotNumber={(searchSlot ?? 0) + 1}
        legalMoveNames={legalMoveNames}
        moveDataCache={moveDataCache}
        alreadyChosen={value as unknown as string[]}
        loading={loading}
        onPick={(moveName) => {
          if (searchSlot !== null) handlePickMoveForSlot(searchSlot, moveName);
        }}
      />

      <MoveDetailsDialog
        open={detailMove !== null}
        onOpenChange={(o) => {
          if (!o) setDetailMove(null);
        }}
        move={detailMove ? moveDataCache[detailMove.name] ?? null : null}
        onRemove={
          detailMove
            ? () => {
                handleRemoveMove(detailMove.index);
                setDetailMove(null);
              }
            : undefined
        }
      />
    </div>
  );
}
