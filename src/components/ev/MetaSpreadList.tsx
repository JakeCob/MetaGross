"use client";

import type { MetaSpread } from "@/lib/types/ev";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface MetaSpreadListProps {
  species: string;
  spreads: MetaSpread[];
  onSelect?: (spread: MetaSpread) => void;
}

export function MetaSpreadList({
  species,
  spreads,
  onSelect,
}: MetaSpreadListProps) {
  if (spreads.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Meta Spreads</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            No meta spread data available for {species}.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meta Spreads: {species}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1.5">
          {spreads.map((spread, i) => {
            const evText = Object.entries(spread.evs)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${v} ${k.toUpperCase()}`)
              .join(" / ");

            return (
              <button
                key={`${spread.nature}-${i}`}
                type="button"
                onClick={() => onSelect?.(spread)}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/50 cursor-pointer"
              >
                <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">
                  #{spread.rank}
                </span>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">
                      {spread.nature}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {spread.usagePercent.toFixed(1)}%
                    </Badge>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground truncate">
                    {evText}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
