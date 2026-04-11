"use client";

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { UsageStatsCard } from "./UsageStatsCard";

/**
 * Small toggle that shows "Meta Usage" and expands into a UsageStatsCard.
 * Designed to be embedded in the team builder alongside a Pokemon form.
 */
export interface UsageQuickViewProps {
  species: string;
  format?: string;
}

export function UsageQuickView({ species, format = "gen9vgc2025" }: UsageQuickViewProps) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  if (!species) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1.5 text-left cursor-pointer group"
      >
        <Badge
          variant="info"
          className="text-[10px] transition-colors group-hover:bg-cyan-500/30"
        >
          Meta Usage
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {expanded ? "Hide" : "Show Smogon stats"}
        </span>
      </button>

      {expanded && (
        <UsageStatsCard species={species} format={format} compact />
      )}
    </div>
  );
}
