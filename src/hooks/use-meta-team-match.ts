"use client";

import { useEffect, useRef, useState } from "react";
import type { MetaTeamMatch } from "@/lib/meta-teams/types";

/**
 * Debounced fetch of meta-team matches for a partial species list.
 * Re-fires whenever the species array changes (after a 300ms quiet
 * window) and aborts the in-flight request when the list changes
 * again — so typing fast doesn't pile up requests.
 */
export function useMetaTeamMatch(
  species: string[],
  format = "champions-reg-m-a",
): {
  matches: MetaTeamMatch[];
  status: "idle" | "loading" | "done" | "error";
} {
  const [matches, setMatches] = useState<MetaTeamMatch[]>([]);
  const [status, setStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const abortRef = useRef<AbortController | null>(null);

  // Keep a stable key so we only refire when the set actually changes.
  const key = JSON.stringify(
    [...species].map((s) => s.trim().toLowerCase()).sort(),
  );

  useEffect(() => {
    const list = species.filter(Boolean);
    if (list.length < 2) {
      setMatches([]);
      setStatus("idle");
      return;
    }

    setStatus("loading");
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;

      try {
        const res = await fetch("/api/meta-teams/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ species: list, format, minOverlap: 2, limit: 6 }),
          signal: ctl.signal,
        });
        if (!res.ok) throw new Error(`match HTTP ${res.status}`);
        const data = (await res.json()) as { matches: MetaTeamMatch[] };
        setMatches(data.matches ?? []);
        setStatus("done");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("[meta-teams] match failed", err);
        setStatus("error");
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
    // key intentionally narrows dep to the species identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, format]);

  return { matches, status };
}
