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

export interface AITeamSuggestionsProps {
  pokemon: string[]; // species names of filled slots
  format: string;
  onAdd: (species: string) => void;
  hasEmptySlots: boolean;
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
// Component
// ---------------------------------------------------------------------------

export function AITeamSuggestions({
  pokemon,
  format,
  onAdd,
  hasEmptySlots,
}: AITeamSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<TeamSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastFetchKey = useRef<string>("");

  const fetchSuggestions = useCallback(async (team: string[], fmt: string) => {
    const fetchKey = team.sort().join(",") + "|" + fmt;
    if (fetchKey === lastFetchKey.current) return;
    lastFetchKey.current = fetchKey;

    // Cancel any in-flight request
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

  // Fetch when the team composition changes (debounced)
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Don't render if no Pokemon are filled
  if (pokemon.length === 0) return null;

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
      </CardHeader>

      {!collapsed && (
        <CardContent className="pt-2">
          {/* Loading state */}
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

          {/* Error state */}
          {error && !loading && (
            <div className="py-2 text-xs text-muted-foreground">
              Could not load suggestions. Build your team manually or ask the AI
              assistant.
            </div>
          )}

          {/* Suggestions list */}
          {suggestions.length > 0 && (
            <div className="flex flex-col gap-2">
              {suggestions.map((suggestion) => {
                const config = CATEGORY_CONFIG[suggestion.category];
                return (
                  <div
                    key={suggestion.species}
                    className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-background/50 px-2.5 py-2 transition-colors hover:bg-accent/5"
                  >
                    {/* Sprite */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center">
                      <PokemonSprite species={suggestion.species} size={36} />
                    </div>

                    {/* Info */}
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

                    {/* Add button */}
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
              })}

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

          {/* No suggestions yet, but not loading */}
          {!loading && !error && suggestions.length === 0 && pokemon.length > 0 && (
            <div className="py-2 text-xs text-muted-foreground">
              Add more Pokemon to get suggestions.
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
