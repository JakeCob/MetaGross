"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const filteredMoves = useMemo(() => {
    if (!searchQuery.trim()) return legalMoveNames.slice(0, 30);
    const lower = searchQuery.toLowerCase();
    return legalMoveNames
      .filter((name) => name.toLowerCase().includes(lower))
      .slice(0, 30);
  }, [searchQuery, legalMoveNames]);

  const handleSelectMove = useCallback(
    (moveName: string) => {
      // Find first empty slot
      const emptyIndex = value.findIndex((m) => !m);
      if (emptyIndex === -1) return; // All slots filled

      // Don't allow duplicate moves
      if (value.includes(moveName)) return;

      const newMoves = [...value] as [string, string, string, string];
      newMoves[emptyIndex] = moveName;
      onChange(newMoves);
      setSearchQuery("");
      setIsDropdownOpen(false);
      setHighlightIndex(-1);
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isDropdownOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < filteredMoves.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : filteredMoves.length - 1,
        );
      } else if (e.key === "Enter" && highlightIndex >= 0) {
        e.preventDefault();
        handleSelectMove(filteredMoves[highlightIndex]);
      } else if (e.key === "Escape") {
        setIsDropdownOpen(false);
        setHighlightIndex(-1);
      }
    },
    [isDropdownOpen, filteredMoves, highlightIndex, handleSelectMove],
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
        setHighlightIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filledCount = value.filter(Boolean).length;
  const canAddMore = filledCount < 4;

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
                <button
                  type="button"
                  onClick={() => handleRemoveMove(i)}
                  className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-left transition-colors hover:border-destructive hover:bg-red-950/20 cursor-pointer"
                  title="Click to remove"
                >
                  <span className="flex-1 font-medium truncate">
                    {moveName}
                  </span>
                  {moveData && (
                    <div className="flex gap-1 shrink-0">
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
                </button>
              ) : (
                <div className="flex h-[38px] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                  Slot {i + 1}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Search input */}
      {canAddMore && species && (
        <div ref={containerRef} className="relative">
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
              setHighlightIndex(-1);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={loading ? "Loading moves..." : "Search moves..."}
            disabled={loading}
            autoComplete="off"
          />

          {isDropdownOpen && (
            <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
              {filteredMoves.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  {loading ? "Loading..." : "No matching moves"}
                </div>
              ) : (
                filteredMoves.map((moveName, i) => {
                  const data = moveDataCache[moveName];
                  const isAlreadySelected = value.includes(moveName);
                  return (
                    <button
                      key={moveName}
                      type="button"
                      onClick={() => handleSelectMove(moveName)}
                      onMouseEnter={() => setHighlightIndex(i)}
                      disabled={isAlreadySelected}
                      className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors cursor-pointer ${
                        isAlreadySelected
                          ? "opacity-40 cursor-not-allowed"
                          : i === highlightIndex
                            ? "bg-accent/20 text-foreground"
                            : "text-foreground hover:bg-border/30"
                      }`}
                    >
                      <span className="flex-1 truncate">{moveName}</span>
                      {data && (
                        <div className="flex gap-1 shrink-0">
                          <Badge
                            className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[data.type] ?? "bg-gray-600 text-white"}`}
                          >
                            {data.type}
                          </Badge>
                          <Badge
                            className={`text-[10px] px-1.5 py-0 ${CATEGORY_STYLES[data.category] ?? ""}`}
                          >
                            {data.category}
                          </Badge>
                          {data.basePower > 0 && (
                            <span className="text-[10px] text-muted-foreground font-mono">
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
          )}
        </div>
      )}
    </div>
  );
}
