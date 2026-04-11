"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { MatchCard, type MatchCardData } from "./MatchCard";
import {
  MatchFilters,
  defaultFilters,
  type MatchFilterState,
} from "./MatchFilters";

function toMatchCardData(raw: Record<string, unknown>): MatchCardData {
  return {
    id: raw.id as string,
    result: (raw.result as string) ?? null,
    mode: (raw.mode as string) ?? null,
    format: (raw.format as string) ?? null,
    playedAt: (raw.playedAt as number) ?? null,
    opponentName: (raw.opponentName as string) ?? null,
    myLeads: Array.isArray(raw.myLeads) ? (raw.myLeads as string[]) : [],
    opponentLeads: Array.isArray(raw.opponentLeads)
      ? (raw.opponentLeads as string[])
      : [],
    myBrought: Array.isArray(raw.myBrought)
      ? (raw.myBrought as string[])
      : [],
    opponentBrought: Array.isArray(raw.opponentBrought)
      ? (raw.opponentBrought as string[])
      : [],
    notes: (raw.notes as string) ?? null,
  };
}

function applyFilters(
  matches: MatchCardData[],
  filters: MatchFilterState,
): MatchCardData[] {
  let filtered = matches;

  // Result filter
  if (filters.result !== "all") {
    filtered = filtered.filter((m) => m.result === filters.result);
  }

  // Pokemon filter (case-insensitive, matches brought)
  if (filters.pokemon.trim()) {
    const query = filters.pokemon.trim().toLowerCase();
    filtered = filtered.filter((m) =>
      m.myBrought.some((p) => p.toLowerCase().includes(query)),
    );
  }

  // Date range filter
  if (filters.dateRange !== "all") {
    const days = parseInt(filters.dateRange, 10);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    filtered = filtered.filter(
      (m) => m.playedAt !== null && m.playedAt >= cutoff,
    );
  }

  // Format filter
  if (filters.format !== "all") {
    filtered = filtered.filter((m) => m.format === filters.format);
  }

  return filtered;
}

export function MatchList() {
  const [matches, setMatches] = useState<MatchCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MatchFilterState>(defaultFilters);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/matches");
      if (!res.ok) throw new Error("Failed to fetch matches");
      const data = await res.json();
      const raw = (data.matches ?? []) as Record<string, unknown>[];
      setMatches(raw.map(toMatchCardData));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const filteredMatches = useMemo(
    () => applyFilters(matches, filters),
    [matches, filters],
  );

  // Extract unique format values for the dropdown
  const availableFormats = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches) {
      if (m.format) set.add(m.format);
    }
    return Array.from(set).sort();
  }, [matches]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-muted-foreground">Loading matches...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          onClick={fetchMatches}
          className="mt-2 text-sm text-primary hover:underline cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-4">&#9876;</div>
        <h2 className="text-xl font-semibold">No matches recorded</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Log your first battle to start building your match history. You can
          manually enter results or import from a replay.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <MatchFilters
        filters={filters}
        onFilterChange={setFilters}
        formats={availableFormats}
      />

      <p className="text-sm text-muted-foreground">
        Showing {filteredMatches.length} of {matches.length} matches
      </p>

      {filteredMatches.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No matches match the current filters.
        </p>
      ) : (
        <div className="grid gap-3">
          {filteredMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}
