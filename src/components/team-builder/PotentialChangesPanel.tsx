"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { PotentialChangeAnalysis } from "@/lib/types/analysis";

type ApplyChange = NonNullable<PotentialChangeAnalysis["setTweaks"][number]["apply"]>;

export interface PotentialChangesPanelProps {
  team: Partial<TeamPokemon>[];
  format: string;
  /** One-click apply a structured set tweak to the matching slot. */
  onApplyTweak?: (species: string, apply: ApplyChange) => void;
  /** Report a markdown section for the builder's "Export analysis". */
  onMarkdown?: (md: string | null) => void;
}

function toMarkdown(d: PotentialChangeAnalysis): string {
  const lines = ["## Potential changes", "", "**Pokémon**"];
  for (const s of d.swaps) lines.push(`- ${s.title}${s.reasoning ? ` — ${s.reasoning}` : ""}`);
  lines.push("", "**Sets**");
  for (const s of d.setTweaks) lines.push(`- ${s.species}: ${s.suggestion}`);
  if (d.note) lines.push("", `_${d.note}_`);
  return lines.join("\n");
}

export function PotentialChangesPanel({ team, format, onApplyTweak, onMarkdown }: PotentialChangesPanelProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PotentialChangeAnalysis | null>(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledCount = team.filter((p) => p.species?.trim()).length;

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filled = team.filter((p) => p.species?.trim());
      const res = await fetch("/api/analysis/potential-changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: filled, format }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setData(j.analysis as PotentialChangeAnalysis);
      setCached(!!j.cached);
      onMarkdown?.(toMarkdown(j.analysis as PotentialChangeAnalysis));
    } catch (e) {
      setError((e as Error).message ?? "Failed to analyze");
    } finally {
      setLoading(false);
    }
  }, [team, format, onMarkdown]);

  return (
    <Card size="sm" className="bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            🛠️ Potential changes
            <span className="text-[10px] font-normal text-muted-foreground">
              AI swaps + set tweaks for your team
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
            <Button
              size="xs"
              disabled={loading || filledCount < 2}
              onClick={analyze}
            >
              {loading ? "Analyzing…" : data ? "Re-analyze" : "Analyze team"}
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

          {data && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Roster swaps */}
              <div className="flex flex-col gap-1.5 rounded-lg border border-border/50 bg-background/40 p-2.5">
                <div className="text-xs font-semibold text-blue-400">Pokémon</div>
                {data.swaps.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground">No roster swaps suggested.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {data.swaps.map((s, i) => (
                      <li key={i} className="text-[11px] leading-snug">
                        <span className="font-semibold text-foreground">• {s.title}</span>
                        {s.reasoning ? (
                          <span className="text-muted-foreground"> — {s.reasoning}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Per-mon set tweaks */}
              <div className="flex flex-col gap-1.5 rounded-lg border border-border/50 bg-background/40 p-2.5">
                <div className="text-xs font-semibold text-rose-400">Sets</div>
                {data.setTweaks.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground">No set tweaks suggested.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {data.setTweaks.map((s, i) => {
                      const onTeam = team.some(
                        (p) => p.species?.trim().toLowerCase() === s.species.trim().toLowerCase(),
                      );
                      return (
                        <li key={i} className="text-[11px] leading-snug">
                          <span className="font-semibold text-foreground">• {s.species}:</span>{" "}
                          <span className="text-muted-foreground">{s.suggestion}</span>
                          {s.apply && onApplyTweak && onTeam && (
                            <button
                              type="button"
                              onClick={() => onApplyTweak(s.species, s.apply!)}
                              className="ml-1.5 rounded border border-primary/40 px-1 py-0 text-[9px] text-primary hover:bg-primary/10"
                            >
                              Apply
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {data?.note && (
            <p className="text-[10px] italic text-muted-foreground/80">{data.note}</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
