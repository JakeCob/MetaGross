"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PokemonSprite } from "@/components/pokemon-sprite";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { CommonCombinationsAnalysis } from "@/lib/types/analysis";

export interface CommonCombinationsPanelProps {
  team: Partial<TeamPokemon>[];
  format: string;
  /** Reorder the builder slots so these species become the leads (slots 1-2). */
  onSetLeads?: (leads: string[]) => void;
}

function SpriteRow({ species }: { species: string[] }) {
  return (
    <div className="flex items-center gap-0.5">
      {species.filter(Boolean).map((sp, i) => (
        <div key={`${sp}-${i}`} className="flex h-7 w-7 items-center justify-center">
          <PokemonSprite species={sp} size={28} />
        </div>
      ))}
    </div>
  );
}

export function CommonCombinationsPanel({ team, format, onSetLeads }: CommonCombinationsPanelProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CommonCombinationsAnalysis | null>(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledCount = team.filter((p) => p.species?.trim()).length;

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filled = team.filter((p) => p.species?.trim());
      const res = await fetch("/api/analysis/common-combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: filled, format }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setData(j.analysis as CommonCombinationsAnalysis);
      setCached(!!j.cached);
    } catch (e) {
      setError((e as Error).message ?? "Failed to analyze");
    } finally {
      setLoading(false);
    }
  }, [team, format]);

  return (
    <Card size="sm" className="bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            🤝 Common combinations
            <span className="text-[10px] font-normal text-muted-foreground">
              AI lead + back combos for your team
            </span>
          </span>
          <Button size="xs" variant="outline" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide" : "Open"}
          </Button>
        </CardTitle>
      </CardHeader>

      {open && (
        <CardContent className="flex flex-col gap-3 pt-0">
          <div className="flex items-center gap-2">
            <Button size="xs" disabled={loading || filledCount < 2} onClick={analyze}>
              {loading ? "Analyzing…" : data ? "Re-analyze" : "Find combos"}
            </Button>
            {filledCount < 2 && (
              <span className="text-[10px] text-muted-foreground">
                Add at least 2 Pokémon first.
              </span>
            )}
            {cached && data && (
              <span className="text-[9px] text-muted-foreground/60">cached</span>
            )}
          </div>

          {error && <div className="text-xs text-destructive">{error}</div>}

          {data && data.combos.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {/* Header row */}
              <div className="grid grid-cols-[1.25rem_auto_auto_1fr] items-center gap-2 px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>#</span>
                <span>Leads</span>
                <span>Back</span>
                <span>Strategy</span>
              </div>
              {data.combos.map((c, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1.25rem_auto_auto_1fr] items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-1.5 py-1.5"
                >
                  <span className="text-[11px] font-bold text-primary">{i + 1}</span>
                  <SpriteRow species={c.leads} />
                  <SpriteRow species={c.back} />
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      {c.strategy}
                    </p>
                    {onSetLeads &&
                      c.leads.length >= 2 &&
                      c.leads.every((lead) =>
                        team.some(
                          (p) => p.species?.trim().toLowerCase() === lead.trim().toLowerCase(),
                        ),
                      ) && (
                        <button
                          type="button"
                          onClick={() => onSetLeads(c.leads)}
                          className="self-start rounded border border-primary/40 px-1.5 py-0 text-[9px] text-primary hover:bg-primary/10"
                        >
                          ↳ Set as leads
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {data && data.combos.length === 0 && !error && (
            <p className="text-[10px] text-muted-foreground">No combos suggested.</p>
          )}

          <p className="text-[9px] italic text-muted-foreground/70">
            {data?.note ?? "Not exhaustive — a quick read on solid combos."}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
