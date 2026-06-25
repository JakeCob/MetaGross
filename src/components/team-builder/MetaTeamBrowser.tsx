"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PokemonSprite } from "@/components/pokemon-sprite";
import type { MetaTeam } from "@/lib/meta-teams/types";

export interface MetaTeamBrowserProps {
  format: string;
  /** Import a proven team into the builder slots. May fetch the full set from
   *  the team's pokepaste, so it can be async. */
  onUseTeam: (team: MetaTeam) => void | Promise<void>;
}

const SOURCE_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "info" | "success" | "warning" }> = {
  limitless: { label: "Limitless", variant: "info" },
  vgcpastes: { label: "VGCPastes", variant: "secondary" },
  pikalytics: { label: "Pikalytics", variant: "success" },
  creator: { label: "Creator", variant: "warning" },
  victoryroad: { label: "Victory Road", variant: "warning" },
  labmaus: { label: "Labmaus", variant: "info" },
  smogon: { label: "Smogon", variant: "secondary" },
  reddit: { label: "Reddit", variant: "secondary" },
  user: { label: "User", variant: "default" },
};

export function MetaTeamBrowser({ format, onUseTeam }: MetaTeamBrowserProps) {
  const [teams, setTeams] = useState<MetaTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [usingId, setUsingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/meta-teams/list?format=${encodeURIComponent(format)}&limit=24`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setTeams((data.teams as MetaTeam[]) ?? []);
      setFallback(!!data.fallback);
      setLoaded(true);
    } catch (err) {
      setError((err as Error).message ?? "Failed to load proven teams");
    } finally {
      setLoading(false);
    }
  }, [format]);

  return (
    <Card size="sm" className="bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            🏆 Proven tournament teams
            <span className="text-[10px] font-normal text-muted-foreground">
              reference / copy open-sheet lists
            </span>
          </span>
          <Button size="xs" variant="outline" onClick={load} disabled={loading}>
            {loading ? "Loading…" : loaded ? "Refresh" : "Load"}
          </Button>
        </CardTitle>
      </CardHeader>

      {(loaded || loading || error) && (
        <CardContent className="flex flex-col gap-2 pt-0">
          {error && <div className="text-xs text-destructive">{error}</div>}

          {fallback && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[10px] text-amber-400/90">
              No tournament teams indexed for this regulation yet — showing proven
              <strong> Reg M-A</strong> teams to reference and adapt to M-B.
            </div>
          )}

          {loaded && !loading && teams.length === 0 && !error && (
            <div className="py-2 text-xs text-muted-foreground">
              No proven teams indexed yet. Run the meta-teams aggregate to pull
              the latest tournament results.
            </div>
          )}

          {teams.map((t) => {
            const badge = SOURCE_BADGE[t.source] ?? { label: t.source, variant: "default" as const };
            const mons = t.pokemon.length > 0
              ? t.pokemon.map((p) => p.species)
              : t.species;
            return (
              <div
                key={t.id}
                className="flex flex-col gap-1.5 rounded-lg border border-border/50 bg-background/50 px-2.5 py-2"
              >
                <div className="flex items-center gap-1.5">
                  <Badge variant={badge.variant} className="text-[9px] px-1.5 py-0 h-3.5 shrink-0">
                    {badge.label}
                  </Badge>
                  {t.archetype && (
                    <span className="text-[10px] font-semibold text-foreground truncate">
                      {t.archetype}
                    </span>
                  )}
                  {t.author && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      · {t.author}
                    </span>
                  )}
                  {t.sourceUrl && (
                    <a
                      href={t.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto shrink-0 text-[10px] text-primary hover:underline"
                    >
                      source ↗
                    </a>
                  )}
                </div>

                {t.record && (
                  <div className="text-[10px] text-muted-foreground truncate">
                    {t.record}
                  </div>
                )}

                <div className="flex items-center gap-1">
                  {mons.slice(0, 6).map((sp, i) => (
                    <div key={`${t.id}-${i}`} className="flex h-7 w-7 items-center justify-center">
                      <PokemonSprite species={sp} size={28} />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="xs"
                    className="ml-auto shrink-0 text-[10px] h-6 px-2"
                    disabled={usingId === t.id}
                    onClick={async () => {
                      setUsingId(t.id);
                      try {
                        await onUseTeam(t);
                      } finally {
                        setUsingId(null);
                      }
                    }}
                  >
                    {usingId === t.id ? "Loading…" : "Use this team"}
                  </Button>
                </div>
              </div>
            );
          })}

          {teams.length > 0 && (
            <p className="text-[9px] text-muted-foreground/60">
              Pulls the full set from the team&apos;s pokepaste when available —
              otherwise imports species only; run the AI EV Optimizer or Team
              Debate to complete spreads.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
