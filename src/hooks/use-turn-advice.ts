"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBattleLogger } from "@/stores/use-battle-logger";
import { consumeSSEStream } from "@/lib/sse-client";
import type { TurnAdvice } from "@/lib/ai/battle-coach/types";

/**
 * Drive the Battle Coach's per-turn advice.
 *
 * - Auto-runs when a new turn starts (currentTurn bumps AND
 *   currentTurnActions is empty) and the opponent has at least one
 *   live active.
 * - Manual `refresh()` forces a re-run (e.g., after a major reveal).
 * - Caches the last advice by turn number; UI can show staleness.
 */
export function useTurnAdvice() {
  const store = useBattleLogger();
  const [advice, setAdvice] = useState<TurnAdvice | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;

  // Clear advice when the match is reset (e.g., user starts a new battle).
  useEffect(() => {
    if (store.phase === "idle" || store.phase === "teamEntry") {
      setAdvice(null);
      setStatus("idle");
      setError(null);
    }
  }, [store.phase]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const run = useCallback(async () => {
    const s = storeRef.current;
    if (s.activeP1.length === 0 || s.activeP2.length === 0) return;
    if (s.phase !== "inProgress") return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("running");
    setError(null);

    try {
      const res = await fetch("/api/battle-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnNumber: s.currentTurn,
          activeP1: s.activeP1,
          activeP2: s.activeP2,
          fieldState: s.fieldState,
          myTeam: s.myTeam,
          myBrought: s.myBrought,
          opponentTeam: s.opponentTeam,
          opponentBrought: s.opponentBrought,
          faintedP1: s.faintedP1,
          faintedP2: s.faintedP2,
          // Only send the last 5 turns — otherwise we balloon the prompt.
          recentTurns: s.turns.slice(-5),
          scouting: s.scoutingAnalysis,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`coach HTTP ${res.status}`);

      await consumeSSEStream(res.body.getReader(), {
        advice: (data) => {
          setAdvice(data as unknown as TurnAdvice);
          setStatus("done");
        },
        error: (data) => {
          setError((data.message as string) ?? "coach error");
          setStatus("error");
        },
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("[turn-advice] failed", err);
        setError((err as Error).message);
        setStatus("error");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  // Auto-trigger: on turn start (turn number changes AND no actions yet).
  useEffect(() => {
    if (store.phase !== "inProgress") return;
    if (store.activeP1.length === 0 || store.activeP2.length === 0) return;
    if (store.currentTurnActions.length > 0) return;
    if (advice?.turnNumber === store.currentTurn) return;
    run();
    // Intentionally narrow deps: we want to fire ONLY when turn number
    // flips, not every boost/HP tweak. The UI exposes `refresh()` for
    // other triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.currentTurn, store.phase]);

  return {
    advice,
    status,
    error,
    refresh: run,
    isStale:
      advice != null && advice.turnNumber !== store.currentTurn,
  };
}
