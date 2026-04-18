"use client";

import { useEffect, useRef, useState } from "react";

export interface TeammateSuggestion {
  species: string;
  usage: number;
  /** Which entered species cited this teammate — so the UI can show
   *  "via Pelipper" if useful. */
  sources: string[];
}

/**
 * Fetch `/api/pokemon/usage?species=X` for each entered species, merge
 * their `teammates` lists, dedupe, filter out species already entered,
 * and return a ranked suggestion list.
 *
 * Uses a small in-hook memo so we don't refetch a species we already
 * have data for within the same session.
 */
export function useCommonTeammates(
  enteredSpecies: string[],
  limit = 10,
): {
  suggestions: TeammateSuggestion[];
  status: "idle" | "loading" | "done" | "error";
} {
  const [suggestions, setSuggestions] = useState<TeammateSuggestion[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const cacheRef = useRef<
    Map<string, { name: string; usage: number }[]>
  >(new Map());

  const filled = enteredSpecies.filter(Boolean);
  const key = JSON.stringify([...filled].sort());

  useEffect(() => {
    if (filled.length === 0) {
      setSuggestions([]);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");

    (async () => {
      const byName = new Map<string, TeammateSuggestion>();

      for (const species of filled) {
        let entries = cacheRef.current.get(species);
        if (!entries) {
          try {
            const res = await fetch(
              `/api/pokemon/usage?species=${encodeURIComponent(species)}`,
            );
            if (!res.ok) continue;
            const data = (await res.json()) as {
              teammates?: { name: string; usage: number }[];
            };
            entries = data.teammates ?? [];
            cacheRef.current.set(species, entries);
          } catch {
            continue;
          }
        }

        if (cancelled) return;
        for (const mate of entries) {
          const name = mate.name;
          if (!name) continue;
          // Drop anything the user has already entered.
          if (
            filled.some((s) => s.toLowerCase() === name.toLowerCase())
          ) {
            continue;
          }
          const prev = byName.get(name);
          if (prev) {
            prev.usage = Math.max(prev.usage, mate.usage);
            if (!prev.sources.includes(species)) prev.sources.push(species);
          } else {
            byName.set(name, {
              species: name,
              usage: mate.usage,
              sources: [species],
            });
          }
        }
      }

      if (cancelled) return;

      const ranked = [...byName.values()]
        .sort((a, b) => {
          // Prefer suggestions cited by MORE of the entered species (core
          // recognition), then higher usage.
          const sd = b.sources.length - a.sources.length;
          if (sd !== 0) return sd;
          return b.usage - a.usage;
        })
        .slice(0, limit);

      setSuggestions(ranked);
      setStatus("done");
    })().catch((err) => {
      console.error("[teammates] fetch failed", err);
      if (!cancelled) setStatus("error");
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, limit]);

  return { suggestions, status };
}
