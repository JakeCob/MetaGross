"use client";

import { useCallback, useEffect, useRef } from "react";
import { useBattleLogger } from "@/stores/use-battle-logger";
import { consumeSSEStream } from "@/lib/sse-client";
import { collectObservations } from "@/lib/ev/collect-observations";
import type { ScoutingResult } from "@/lib/ai/opponent-scouting/types";

/**
 * Orchestrates an Opponent Scouting request:
 * - computes a stable hash of the opponent snapshot (via the server's
 *   response so client and server always agree),
 * - skips the request if the stored result already matches the hash,
 * - consumes SSE updates and writes them back to the battle-logger
 *   store, and
 * - exposes a cancel() handle.
 *
 * The hook is idempotent — calling `run()` while a request is in flight
 * does nothing unless `forceRefresh` is true.
 */
export function useScoutingRunner() {
  const store = useBattleLogger();
  const abortRef = useRef<AbortController | null>(null);
  // Refs so the stable `run` callback can read current store values
  // without resubscribing every render.
  const storeRef = useRef(store);
  storeRef.current = store;

  // Abort any in-flight request when the consumer unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const run = useCallback(
    async (opts: { forceRefresh?: boolean } = {}) => {
      const s = storeRef.current;
      if (s.opponentTeam.length === 0) return;
      if (s.scoutingStatus === "running" && !opts.forceRefresh) return;

      // Abort any prior request.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      s.setScoutingStatus("running");

      try {
        // Collect speed + damage observations from the match so far.
        const obs = collectObservations(s.turns, s.myTeam, s.opponentTeam);

        const res = await fetch("/api/opponent-scouting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opponentTeam: s.opponentTeam,
            myTeam: s.myTeam,
            myBrought: s.myBrought,
            format: s.format,
            speedObservations: obs.speed,
            damageObservations: obs.damage,
            forceRefresh: Boolean(opts.forceRefresh),
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`scouting HTTP ${res.status}`);
        }

        await consumeSSEStream(res.body.getReader(), {
          start: (data) => {
            const hash = (data.hash as string) ?? null;
            if (hash) storeRef.current.setScoutingHash(hash);
          },
          "cache-hit": () => {
            // no-op; the next "done" carries the cached result
          },
          done: (data) => {
            const result = data.result as ScoutingResult | undefined;
            const hash = (data.hash as string) ?? null;
            if (result) {
              storeRef.current.setScoutingAnalysis({
                ...result,
                reruns: (storeRef.current.scoutingAnalysis?.reruns ?? 0) + 1,
              });
            }
            if (hash) storeRef.current.setScoutingHash(hash);
            storeRef.current.setScoutingStatus("done");
          },
          error: (data) => {
            console.error(
              "[scouting] server error",
              (data.message as string) ?? data,
            );
            storeRef.current.setScoutingStatus("error");
          },
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("[scouting] request failed", err);
          storeRef.current.setScoutingStatus("error");
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    if (storeRef.current.scoutingStatus === "running") {
      storeRef.current.setScoutingStatus("idle");
    }
  }, []);

  return {
    run,
    cancel,
    status: store.scoutingStatus,
    result: store.scoutingAnalysis,
    hash: store.scoutingHash,
  };
}
