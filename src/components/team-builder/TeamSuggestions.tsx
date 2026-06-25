"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PokemonSprite } from "@/components/pokemon-sprite";
import type { MetaTeam } from "@/lib/meta-teams/types";

type Mode = "featured" | "playstyle" | "meta" | "ai";

interface Suggestion {
  team: MetaTeam;
  archetype: string;
  reason: string;
}
interface SuggestResponse {
  mode: string;
  suggestions: Suggestion[];
  context: Record<string, unknown>;
}

export interface TeamSuggestionsProps {
  format: string;
  /** One-click full-set import (shared with the proven-teams browser). */
  onUseTeam: (team: MetaTeam) => void | Promise<void>;
  /** Seed a species into the builder so the AI debate can build around it. */
  onSeedForAI: (species: string) => void;
}

const MODES: { key: Mode; label: string; hint: string }[] = [
  { key: "featured", label: "✨ Featured Pokémon", hint: "proven teams that run a Pokémon you pick" },
  { key: "playstyle", label: "🎭 My Playstyle", hint: "proven teams across your favored archetypes" },
  { key: "meta", label: "🛡️ Counter the Meta", hint: "teams that answer the current top threats" },
  { key: "ai", label: "🧠 AI Build", hint: "build an original team around a Pokémon" },
];

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

export function TeamSuggestions({ format, onUseTeam, onSeedForAI }: TeamSuggestionsProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("featured");
  const [species, setSpecies] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [context, setContext] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [loadedMode, setLoadedMode] = useState<Mode | null>(null);

  const fetchSuggestions = useCallback(
    async (m: Mode, sp?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ mode: m, format });
        if (m === "featured" && sp) params.set("species", sp);
        const res = await fetch(`/api/meta-teams/suggest?${params.toString()}`);
        const data: SuggestResponse = await res.json();
        if (!res.ok) throw new Error((data as unknown as { error?: string }).error ?? `HTTP ${res.status}`);
        setSuggestions(data.suggestions ?? []);
        setContext(data.context ?? {});
        setLoadedMode(m);
      } catch (err) {
        setError((err as Error).message ?? "Failed to load suggestions");
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [format],
  );

  const selectMode = useCallback(
    (m: Mode) => {
      setMode(m);
      setSuggestions([]);
      setLoadedMode(null);
      setError(null);
      // Playstyle + meta need no input — fetch immediately.
      if (m === "playstyle" || m === "meta") void fetchSuggestions(m);
    },
    [fetchSuggestions],
  );

  const threats =
    (context.threats as { species: string; usage: number }[] | undefined) ?? [];
  const preferred = (context.preferredArchetypes as string[] | undefined) ?? [];

  return (
    <Card size="sm" className="bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            🔮 Team Suggestions
            <span className="text-[10px] font-normal text-muted-foreground">
              multiple ideas to start from
            </span>
          </span>
          <Button size="xs" variant="outline" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide" : "Suggest teams"}
          </Button>
        </CardTitle>
      </CardHeader>

      {open && (
        <CardContent className="flex flex-col gap-3 pt-0">
          {/* Mode selector */}
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <Button
                key={m.key}
                size="xs"
                variant={mode === m.key ? "default" : "outline"}
                className="text-[10px]"
                onClick={() => selectMode(m.key)}
              >
                {m.label}
              </Button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground -mt-1">
            {MODES.find((m) => m.key === mode)?.hint}
          </p>

          {/* Featured / AI: species input */}
          {(mode === "featured" || mode === "ai") && (
            <div className="flex gap-2">
              <Input
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && species.trim()) {
                    if (mode === "featured") void fetchSuggestions("featured", species.trim());
                    else onSeedForAI(species.trim());
                  }
                }}
                placeholder={mode === "featured" ? "e.g. Pyroar, Archaludon, Mawile" : "e.g. Pyroar — the mon to build around"}
                className="h-7 text-xs"
              />
              {mode === "featured" ? (
                <Button
                  size="xs"
                  disabled={!species.trim() || loading}
                  onClick={() => void fetchSuggestions("featured", species.trim())}
                >
                  {loading ? "…" : "Suggest"}
                </Button>
              ) : (
                <Button
                  size="xs"
                  disabled={!species.trim()}
                  onClick={() => onSeedForAI(species.trim())}
                >
                  Seed → AI debate
                </Button>
              )}
            </div>
          )}

          {mode === "ai" && (
            <p className="text-[10px] text-muted-foreground">
              Adds the Pokémon to your team, then the 🧠 AI Team Debate panel below
              builds an original 6-mon team around it (takes a few minutes).
            </p>
          )}

          {/* Meta: threats considered */}
          {mode === "meta" && threats.length > 0 && (
            <div className="text-[10px] text-muted-foreground">
              vs top threats:{" "}
              {threats.slice(0, 8).map((t) => `${t.species} ${t.usage}%`).join(" · ")}
            </div>
          )}

          {/* Playstyle: archetypes used */}
          {mode === "playstyle" && loadedMode === "playstyle" && (
            <div className="text-[10px] text-muted-foreground">
              {preferred.length > 0
                ? `your favored: ${preferred.join(" · ")}`
                : "no preferences yet — showing a diverse proven spread"}
            </div>
          )}

          {error && <div className="text-xs text-destructive">{error}</div>}
          {loading && <div className="text-xs text-muted-foreground">Finding teams…</div>}

          {!loading && loadedMode && mode !== "ai" && suggestions.length === 0 && !error && (
            <div className="py-2 text-xs text-muted-foreground">
              {mode === "featured"
                ? `No proven teams found running "${species}". Try a base form (e.g. Pyroar, not Mega Pyroar).`
                : "No suggestions available yet."}
            </div>
          )}

          {/* Results */}
          {mode !== "ai" &&
            suggestions.map((s) => {
              const t = s.team;
              const badge = SOURCE_BADGE[t.source] ?? { label: t.source, variant: "default" as const };
              const mons = t.pokemon.length > 0 ? t.pokemon.map((p) => p.species) : t.species;
              return (
                <div
                  key={t.id}
                  className="flex flex-col gap-1.5 rounded-lg border border-border/50 bg-background/50 px-2.5 py-2"
                >
                  <div className="flex items-center gap-1.5">
                    <Badge variant={badge.variant} className="text-[9px] px-1.5 py-0 h-3.5 shrink-0">
                      {badge.label}
                    </Badge>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-3.5 shrink-0">
                      {s.archetype}
                    </Badge>
                    {t.author && (
                      <span className="text-[10px] text-muted-foreground truncate">· {t.author}</span>
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

                  <p className="text-[10px] text-muted-foreground">{s.reason}</p>

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

          {suggestions.length > 0 && mode !== "ai" && (
            <p className="text-[9px] text-muted-foreground/60">
              One click pulls the full set from the team&apos;s pokepaste when available.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
