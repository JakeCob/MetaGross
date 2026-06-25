"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PokemonSprite } from "@/components/pokemon-sprite";
import type { TeamPokemon } from "@/lib/types/pokemon";

export interface SimulationPanelProps {
  team: Partial<TeamPokemon>[];
  format: string;
}

interface SimThreat {
  attacker: string;
  move: string;
  target: string;
  percent: number;
}
interface SimMatchup {
  team: {
    id: string;
    source: string;
    author: string | null;
    record: string | null;
    archetype: string | null;
    sourceUrl: string | null;
    species: string[];
  };
  score: number;
  label: "Favorable" | "Even" | "Tricky" | "Hard";
  youThreaten: number;
  theyThreaten: number;
  speedNote: string;
  worstThreat: SimThreat | null;
}

const LABEL_STYLE: Record<SimMatchup["label"], { bar: string; text: string }> = {
  Favorable: { bar: "bg-emerald-500", text: "text-emerald-400" },
  Even: { bar: "bg-amber-500", text: "text-amber-400" },
  Tricky: { bar: "bg-orange-500", text: "text-orange-400" },
  Hard: { bar: "bg-rose-500", text: "text-rose-400" },
};

export function SimulationPanel({ team, format }: SimulationPanelProps) {
  const [open, setOpen] = useState(false);
  const [matchups, setMatchups] = useState<SimMatchup[] | null>(null);
  const [considered, setConsidered] = useState(0);
  const [field, setField] = useState<{ weather: string | null; tailwind: boolean; trickRoom: boolean } | null>(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledCount = team.filter((p) => p.species?.trim()).length;

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filled = team.filter((p) => p.species?.trim());
      const res = await fetch("/api/teams/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: filled, format }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setMatchups(j.matchups as SimMatchup[]);
      setConsidered(j.opponentsConsidered ?? 0);
      setField(j.field ?? null);
      setCached(!!j.cached);
    } catch (e) {
      setError((e as Error).message ?? "Failed to simulate");
    } finally {
      setLoading(false);
    }
  }, [team, format]);

  return (
    <Card size="sm" className="bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            ⚔️ Tournament simulation
            <span className="text-[10px] font-normal text-muted-foreground">
              damage matchups vs teams you&apos;ll likely face
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
            <Button size="xs" disabled={loading || filledCount < 4} onClick={run}>
              {loading ? "Simulating…" : matchups ? "Re-run" : "Run simulation"}
            </Button>
            {filledCount < 4 && (
              <span className="text-[10px] text-muted-foreground">
                Build a fuller team first (4+ with moves).
              </span>
            )}
            {matchups && (
              <span className="text-[9px] text-muted-foreground/60">
                vs {considered} proven teams
                {field && (field.weather || field.tailwind || field.trickRoom)
                  ? ` · field: ${[
                      field.weather,
                      field.tailwind ? "Tailwind" : null,
                      field.trickRoom ? "Trick Room" : null,
                    ]
                      .filter(Boolean)
                      .join(" + ")}`
                  : ""}
                {cached ? " · cached" : ""}
              </span>
            )}
          </div>

          {error && <div className="text-xs text-destructive">{error}</div>}
          {loading && (
            <div className="text-xs text-muted-foreground">
              Calc-ing KO ranges vs Limitless / Labmaus / Victory Road lists…
            </div>
          )}

          {matchups && matchups.length === 0 && !loading && (
            <p className="text-[10px] text-muted-foreground">
              No proven teams with usable sets to simulate against yet.
            </p>
          )}

          {matchups?.map((m) => {
            const style = LABEL_STYLE[m.label];
            return (
              <div
                key={m.team.id}
                className="flex flex-col gap-1.5 rounded-lg border border-border/50 bg-background/40 px-2.5 py-2"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${style.text}`}>{m.label}</span>
                  <span className="text-[10px] text-muted-foreground">· {m.score}/100</span>
                  {m.team.archetype && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-3.5">
                      {m.team.archetype}
                    </Badge>
                  )}
                  {m.team.author && (
                    <span className="text-[10px] text-muted-foreground truncate">· {m.team.author}</span>
                  )}
                  {m.team.sourceUrl && (
                    <a
                      href={m.team.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto shrink-0 text-[10px] text-primary hover:underline"
                    >
                      list ↗
                    </a>
                  )}
                </div>

                {/* score bar */}
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${m.score}%` }} />
                </div>

                <div className="flex items-center gap-1">
                  {m.team.species.slice(0, 6).map((sp, i) => (
                    <div key={`${m.team.id}-${i}`} className="flex h-6 w-6 items-center justify-center">
                      <PokemonSprite species={sp} size={24} />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
                  <span>
                    You OHKO <span className="text-emerald-400">{m.youThreaten}/6</span>
                  </span>
                  <span>
                    They OHKO <span className="text-rose-400">{m.theyThreaten}/6</span>
                  </span>
                  <span>{m.speedNote}</span>
                </div>

                {m.worstThreat && (
                  <p className="text-[10px] text-muted-foreground/90">
                    ⚠ Biggest threat: {m.worstThreat.attacker} {m.worstThreat.move} → {m.worstThreat.target}{" "}
                    <span className={m.worstThreat.percent >= 100 ? "text-rose-400" : ""}>
                      ({m.worstThreat.percent}%)
                    </span>
                  </p>
                )}
              </div>
            );
          })}

          {matchups && matchups.length > 0 && (
            <p className="text-[9px] text-muted-foreground/60">
              Worst matchups first. Your team&apos;s weather + Tailwind/Trick Room are
              applied; opponent EVs default where their list omits them. Run the EV
              optimizer to harden your soft matchups.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
