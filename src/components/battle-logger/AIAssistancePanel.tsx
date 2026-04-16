"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PokemonSprite } from "@/components/pokemon-sprite";
import { useBattleLogger } from "@/stores/use-battle-logger";
import { useScoutingRunner } from "@/hooks/use-scouting-runner";
import { hashOpponentSnapshot } from "@/lib/ai/opponent-scouting";

/**
 * In-battle AI advisor. Piggybacks on the Opponent Scouting pipeline
 * so we don't run a second graph: the scouting result already contains
 * suggested leads, watch-fors, and a proposed win-condition list.
 *
 * Auto-runs scouting when:
 *   - the opponent team has been entered, AND
 *   - there's no cached scouting result matching the current opponent
 *     snapshot hash (i.e., a new reveal has invalidated the old one).
 *
 * Collapses under a header so it doesn't dominate the logger view.
 */
export function AIAssistancePanel() {
  const store = useBattleLogger();
  const { run, status, result } = useScoutingRunner();
  const [open, setOpen] = useState(true);

  const currentHash = useMemo(
    () => hashOpponentSnapshot(store.opponentTeam, store.format),
    [store.opponentTeam, store.format],
  );
  const stale = result != null && store.scoutingHash !== currentHash;

  // Auto-run on mount / when opponent reveals change the hash.
  useEffect(() => {
    if (store.opponentTeam.length === 0) return;
    if (status === "running") return;
    if (!result) {
      run();
      return;
    }
    if (stale) {
      run();
    }
  }, [store.opponentTeam.length, currentHash, stale, status, result, run]);

  if (store.opponentTeam.length === 0) return null;

  const myLeadCount = store.myLeads.length;
  const showLeadSection = myLeadCount === 0 && result?.suggestedLeads.length;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            AI Coach
          </span>
          {status === "running" && (
            <Badge variant="info" className="text-[9px] animate-pulse">
              Thinking…
            </Badge>
          )}
          {stale && status !== "running" && (
            <Badge variant="warning" className="text-[9px]">
              Stale — new reveal
            </Badge>
          )}
          {!result && status === "idle" && (
            <Badge variant="outline" className="text-[9px]">
              Idle
            </Badge>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 px-3 pb-3">
          {!result && status === "idle" && (
            <p className="text-xs text-muted-foreground">
              Click <strong>Refresh</strong> to ask the AI what to lead, what
              to watch for, and what your win conditions are.
            </p>
          )}

          {status === "error" && (
            <p className="text-xs text-destructive">
              Couldn&apos;t reach the coach. Try refreshing.
            </p>
          )}

          {/* Lead recommendation — only useful before we've led with anything */}
          {showLeadSection && (
            <section className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Lead suggestion
              </span>
              {result!.suggestedLeads.slice(0, 1).map((lead, i) => (
                <div
                  key={i}
                  className="rounded border border-primary/30 bg-primary/10 p-2"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {lead.pair.map((sp) => (
                      <div key={sp} className="flex items-center gap-1">
                        <PokemonSprite species={sp} size={24} />
                        <span className="text-xs font-semibold">{sp}</span>
                      </div>
                    ))}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      score {lead.score}
                    </span>
                  </div>
                  <p className="text-[11px] text-foreground/90">{lead.gamePlan}</p>
                </div>
              ))}
            </section>
          )}

          {/* Watch-fors — always visible once scouted */}
          {result && result.watchFor.length > 0 && (
            <section className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Watch for
              </span>
              <ul className="text-[11px] text-foreground/90 list-disc list-inside space-y-0.5">
                {result.watchFor.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Win conditions — editable checklist */}
          {result && store.winConditions.length > 0 && (
            <section className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Win conditions
              </span>
              <ul className="flex flex-col gap-1">
                {store.winConditions.map((wc) => (
                  <li
                    key={wc.id}
                    className="flex items-start gap-2 rounded border border-border/50 bg-muted/20 px-2 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={wc.status === "met"}
                      onChange={(e) =>
                        store.updateWinCondition(wc.id, {
                          status: e.target.checked ? "met" : "pending",
                        })
                      }
                      className="mt-0.5 accent-primary cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-[11px] ${
                          wc.status === "met"
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {wc.label}
                      </span>
                      <span className="ml-1 text-[9px] text-muted-foreground">
                        ({wc.kind})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => store.removeWinCondition(wc.id)}
                      className="text-[10px] text-muted-foreground hover:text-destructive cursor-pointer"
                      aria-label="Remove condition"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Accept suggested win conditions if none added yet */}
          {result &&
            store.winConditions.length === 0 &&
            result.suggestedWinConditions.length > 0 && (
              <section className="flex flex-col gap-1 rounded border border-dashed border-primary/40 bg-primary/5 p-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Agent suggests
                </span>
                {result.suggestedWinConditions.map((wc) => (
                  <div
                    key={wc.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-[11px] text-foreground/90 flex-1 min-w-0">
                      {wc.label}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px]"
                      onClick={() => store.addWinCondition(wc)}
                    >
                      + Add
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] self-end"
                  onClick={() => {
                    for (const wc of result.suggestedWinConditions) {
                      store.addWinCondition(wc);
                    }
                  }}
                >
                  Add all
                </Button>
              </section>
            )}

          {/* Archetype + synthesis summary */}
          {result && (result.archetype || result.synthesis) && (
            <section className="flex flex-col gap-0.5">
              {result.archetype && (
                <span className="text-[10px] text-muted-foreground">
                  Archetype:{" "}
                  <span className="text-foreground font-medium">
                    {result.archetype}
                  </span>
                </span>
              )}
              {result.synthesis && (
                <p className="text-[10px] text-muted-foreground">
                  {result.synthesis}
                </p>
              )}
            </section>
          )}

          {/* Footer — refresh / full report link */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px]"
              onClick={() => run({ forceRefresh: true })}
              disabled={status === "running"}
            >
              {status === "running" ? "Running…" : "Refresh"}
            </Button>
            <span className="text-[9px] text-muted-foreground">
              Updates automatically on reveals
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
