"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PokemonSprite } from "@/components/pokemon-sprite";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamSuggestion {
  species: string;
  reason: string;
  category: "coverage" | "synergy" | "role" | "meta";
  priority: number;
}

/** Richer per-member context for the AI suggester (item/ability drive synergy). */
export interface AITeamMemberInput {
  species: string;
  item?: string;
  ability?: string;
}

export interface AITeamSuggestionsProps {
  pokemon: string[]; // species names of filled slots
  format: string;
  onAdd: (species: string) => void;
  hasEmptySlots: boolean;
  /** Full slot details so the AI can reason about items/abilities/megas. */
  teamDetails?: AITeamMemberInput[];
}

// ---------------------------------------------------------------------------
// Category styling
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<
  TeamSuggestion["category"],
  { label: string; variant: "default" | "secondary" | "info" | "success" | "warning" }
> = {
  synergy: { label: "Synergy", variant: "success" },
  coverage: { label: "Coverage", variant: "warning" },
  role: { label: "Role", variant: "info" },
  meta: { label: "Meta", variant: "secondary" },
};

// ---------------------------------------------------------------------------
// Shared row
// ---------------------------------------------------------------------------

function SuggestionRow({
  suggestion,
  hasEmptySlots,
  onAdd,
}: {
  suggestion: TeamSuggestion;
  hasEmptySlots: boolean;
  onAdd: (species: string) => void;
}) {
  const config = CATEGORY_CONFIG[suggestion.category];
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-background/50 px-2.5 py-2 transition-colors hover:bg-accent/5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center">
        <PokemonSprite species={suggestion.species} size={36} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground truncate">
            {suggestion.species}
          </span>
          <Badge
            variant={config.variant}
            className="text-[9px] px-1.5 py-0 h-3.5 shrink-0"
          >
            {config.label}
          </Badge>
        </div>
        <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
          {suggestion.reason}
        </span>
      </div>
      {hasEmptySlots && (
        <Button
          variant="outline"
          size="xs"
          className="shrink-0 text-[10px] h-6 px-2"
          onClick={() => onAdd(suggestion.species)}
        >
          Add
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AITeamSuggestions({
  pokemon,
  format,
  onAdd,
  hasEmptySlots,
  teamDetails,
}: AITeamSuggestionsProps) {
  // Heuristic (Pikalytics meta) suggestions — auto-fetched.
  const [suggestions, setSuggestions] = useState<TeamSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastFetchKey = useRef<string>("");

  // AI build-around suggestions — on demand (costs tokens).
  const [aiSuggestions, setAiSuggestions] = useState<TeamSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const aiAbortRef = useRef<AbortController | null>(null);

  const fetchSuggestions = useCallback(async (team: string[], fmt: string) => {
    const fetchKey = team.sort().join(",") + "|" + fmt;
    if (fetchKey === lastFetchKey.current) return;
    lastFetchKey.current = fetchKey;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/teams/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team, format: fmt }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const data = await res.json();
      if (!controller.signal.aborted) {
        setSuggestions(data.suggestions ?? []);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (!controller.signal.aborted) {
        setError((err as Error).message ?? "Failed to load suggestions");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const fetchAISuggestions = useCallback(async () => {
    if (aiAbortRef.current) aiAbortRef.current.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;

    setAiLoading(true);
    setAiError(null);
    setAiUnavailable(false);

    try {
      const team =
        teamDetails && teamDetails.length > 0
          ? teamDetails
          : pokemon.map((s) => ({ species: s }));

      const res = await fetch("/api/teams/suggestions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team, format }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;

      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      if (data.aiAvailable === false) {
        setAiUnavailable(true);
        setAiSuggestions([]);
        return;
      }
      setAiSuggestions(data.suggestions ?? []);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setAiError((err as Error).message ?? "Failed to load AI suggestions");
    } finally {
      if (!controller.signal.aborted) setAiLoading(false);
    }
  }, [pokemon, format, teamDetails]);

  // Fetch heuristic suggestions when the team composition changes (debounced)
  useEffect(() => {
    if (pokemon.length === 0) {
      setSuggestions([]);
      lastFetchKey.current = "";
      return;
    }

    const timeout = setTimeout(() => {
      fetchSuggestions(pokemon, format);
    }, 500);

    return () => clearTimeout(timeout);
  }, [pokemon, format, fetchSuggestions]);

  // Clear stale AI picks when the team/format changes (AI is re-run on demand).
  useEffect(() => {
    setAiSuggestions([]);
    setAiError(null);
    setAiUnavailable(false);
  }, [pokemon, format]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (aiAbortRef.current) aiAbortRef.current.abort();
    };
  }, []);

  // Don't render if no Pokemon are filled
  if (pokemon.length === 0) return null;

  const showAiSection =
    aiLoading || aiSuggestions.length > 0 || !!aiError || aiUnavailable;

  return (
    <Card size="sm" className="bg-card/60">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
            >
              <path d="M12 2v4" />
              <path d="m16 6-2.6 2.6" />
              <path d="M20 12h-4" />
              <path d="m16 18-2.6-2.6" />
              <path d="M12 18v4" />
              <path d="m8 18 2.6-2.6" />
              <path d="M4 12h4" />
              <path d="m8 6 2.6 2.6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
            Team Suggestions
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="xs"
              className="text-[10px] h-6 px-2"
              onClick={fetchAISuggestions}
              disabled={aiLoading}
              title="Reason about synergy, coverage and meta matchups (weather, Trick Room, megas) to build around your current team"
            >
              {aiLoading ? "Thinking…" : "✨ AI build-around"}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand suggestions" : "Collapse suggestions"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${collapsed ? "rotate-180" : ""}`}
              >
                <path d="m18 15-6-6-6 6" />
              </svg>
            </Button>
          </div>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="flex flex-col gap-3 pt-2">
          {/* AI build-around section (on demand) */}
          {showAiSection && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                ✨ AI build-around — synergy + matchups
              </div>

              {aiLoading && aiSuggestions.length === 0 && (
                <div className="py-2 text-xs text-muted-foreground">
                  Reasoning about synergy, coverage and meta matchups…
                </div>
              )}

              {aiUnavailable && (
                <div className="py-2 text-xs text-muted-foreground">
                  AI isn&apos;t configured (set an API key). Showing meta-usage
                  suggestions below.
                </div>
              )}

              {aiError && !aiLoading && (
                <div className="py-2 text-xs text-muted-foreground">
                  {aiError}
                </div>
              )}

              {aiSuggestions.map((s) => (
                <SuggestionRow
                  key={`ai-${s.species}`}
                  suggestion={s}
                  hasEmptySlots={hasEmptySlots}
                  onAdd={onAdd}
                />
              ))}
            </div>
          )}

          {/* Heuristic (meta usage) section */}
          {loading && suggestions.length === 0 && (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <svg
                className="h-3 w-3 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Analyzing team composition...
            </div>
          )}

          {error && !loading && (
            <div className="py-2 text-xs text-muted-foreground">
              Could not load suggestions. Build your team manually or ask the AI
              assistant.
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="flex flex-col gap-2">
              {suggestions.map((suggestion) => (
                <SuggestionRow
                  key={suggestion.species}
                  suggestion={suggestion}
                  hasEmptySlots={hasEmptySlots}
                  onAdd={onAdd}
                />
              ))}

              {/* Source footer */}
              <div className="flex items-center gap-1 pt-1 text-[10px] text-muted-foreground/60">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                Based on meta usage data
                {loading && " (updating...)"}
              </div>
            </div>
          )}

          {/* No heuristic suggestions, not loading */}
          {!loading && !error && suggestions.length === 0 && pokemon.length > 0 && (
            <div className="py-2 text-xs text-muted-foreground">
              No meta-usage matches for these picks — newer Pokemon often have no
              Pikalytics data yet. Use{" "}
              <span className="font-medium text-primary">✨ AI build-around</span>{" "}
              above for synergy + matchup reasoning.
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
