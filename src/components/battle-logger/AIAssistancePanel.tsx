"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PokemonSprite } from "@/components/pokemon-sprite";
import { useBattleLogger } from "@/stores/use-battle-logger";
import { useScoutingRunner } from "@/hooks/use-scouting-runner";
import { useTurnAdvice } from "@/hooks/use-turn-advice";
import type { TurnAdvice } from "@/lib/ai/battle-coach/types";
// Client-safe import (no node deps) — DO NOT import from the barrel
// "@/lib/ai/opponent-scouting", which transitively pulls in pikalytics
// and the LangGraph runtime.
import { hashOpponentSnapshot } from "@/lib/ai/opponent-scouting/hash";

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
  const turnAdvice = useTurnAdvice();
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
          {/* Turn advice — highest priority during an active battle */}
          {store.phase === "inProgress" && (
            <TurnAdviceSection
              turn={store.currentTurn}
              advice={turnAdvice.advice}
              status={turnAdvice.status}
              stale={turnAdvice.isStale}
              onRefresh={turnAdvice.refresh}
            />
          )}

          {!result && status === "idle" && store.phase !== "inProgress" && (
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
                  className="rounded border border-primary/30 bg-primary/10 p-2 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
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
                  {lead.turnOneScripts && lead.turnOneScripts.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {lead.turnOneScripts.map((s, idx) => (
                        <li
                          key={idx}
                          className="rounded border border-primary/20 bg-background/60 p-1.5 text-[11px]"
                        >
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-bold text-primary">
                              {s.label}
                            </span>
                            <span className="text-muted-foreground">
                              if they lead{" "}
                              <span className="text-foreground">
                                {s.opponentLeads}
                              </span>
                            </span>
                          </div>
                          <p className="text-foreground/90 mt-0.5">{s.play}</p>
                          {s.logic && (
                            <p className="text-muted-foreground italic mt-0.5">
                              {s.logic}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Threat taxonomy — role-by-role opponent breakdown */}
          {result &&
            result.threatTaxonomy &&
            result.threatTaxonomy.length > 0 && (
              <section className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Threat breakdown
                </span>
                <ul className="flex flex-col gap-0.5 text-[11px]">
                  {result.threatTaxonomy.map((t, i) => (
                    <li
                      key={i}
                      className="rounded border border-border/40 bg-muted/10 px-2 py-1"
                    >
                      <span className="font-semibold text-foreground">
                        {t.role}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        ({t.species.join(", ")})
                      </span>
                      <p className="text-foreground/90 mt-0.5">
                        {t.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

          {/* Ability interactions — Intimidate / Competitive / Defiant etc. */}
          {result &&
            result.abilityInteractions &&
            result.abilityInteractions.length > 0 && (
              <section className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Ability interactions
                </span>
                <ul className="text-[11px] text-foreground/90 list-disc list-inside space-y-0.5">
                  {result.abilityInteractions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
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

          {/* Late-game plan — what the win looks like after the first trade */}
          {result && result.lateGameWinCon && (
            <section className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Late-game plan
              </span>
              <p className="text-[11px] text-foreground/90 rounded border border-emerald-500/30 bg-emerald-500/5 px-2 py-1">
                {result.lateGameWinCon}
              </p>
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

// ---------------------------------------------------------------------------
// TurnAdviceSection — renders the live coach output for the current turn.
// Compact block styled to read at a glance during a real battle.
// ---------------------------------------------------------------------------

function winProbTone(p: number): string {
  if (p >= 70) return "text-emerald-400";
  if (p >= 45) return "text-amber-400";
  return "text-rose-400";
}

function TurnAdviceSection({
  turn,
  advice,
  status,
  stale,
  onRefresh,
}: {
  turn: number;
  advice: TurnAdvice | null;
  status: "idle" | "running" | "done" | "error";
  stale: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-lg border border-primary/40 bg-primary/10 p-2">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Turn {turn} — Live coach
          </span>
          {status === "running" && (
            <Badge variant="info" className="text-[9px] animate-pulse">
              Thinking…
            </Badge>
          )}
          {stale && status !== "running" && (
            <Badge variant="warning" className="text-[9px]">
              Stale
            </Badge>
          )}
          {advice && (
            <span
              className={`text-[10px] font-mono ${winProbTone(advice.winProbability)}`}
              title="Coach's win-probability estimate for this turn"
            >
              Win {advice.winProbability}%
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px]"
          onClick={onRefresh}
          disabled={status === "running"}
        >
          {status === "running" ? "Running…" : "Refresh"}
        </Button>
      </div>

      {status === "running" && !advice && (
        <p className="text-xs text-muted-foreground animate-pulse">
          Reading the board…
        </p>
      )}
      {status === "error" && (
        <p className="text-xs text-destructive">
          Coach unavailable — try Refresh.
        </p>
      )}

      {advice && (
        <div className="flex flex-col gap-2 text-xs">
          {/* Per-slot action recommendations */}
          {advice.myActions.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {advice.myActions.map((a, i) => (
                <li
                  key={`${a.species}-${i}`}
                  className="flex gap-2 rounded border border-border/40 bg-card/80 p-1.5"
                >
                  <PokemonSprite species={a.species} size={24} />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold text-foreground leading-tight">
                      {a.species}: {a.recommendation}
                      {a.target && (
                        <span className="ml-1 text-primary/90">→ {a.target}</span>
                      )}
                    </span>
                    <span className="text-muted-foreground leading-snug">
                      {a.reasoning}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Opponent prediction + backup plan */}
          {(advice.opponentPlan || advice.backupPlan) && (
            <div className="grid grid-cols-1 gap-1">
              {advice.opponentPlan && (
                <div className="rounded border border-rose-500/30 bg-rose-500/5 px-2 py-1">
                  <span className="text-[10px] uppercase tracking-wider text-rose-400">
                    Expect
                  </span>
                  <p className="text-xs text-foreground/90 mt-0.5">
                    {advice.opponentPlan}
                  </p>
                </div>
              )}
              {advice.backupPlan && (
                <div className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1">
                  <span className="text-[10px] uppercase tracking-wider text-amber-400">
                    If they deviate
                  </span>
                  <p className="text-xs text-foreground/90 mt-0.5">
                    {advice.backupPlan}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Optional caution */}
          {advice.keyNote && (
            <div className="rounded border border-fuchsia-500/30 bg-fuchsia-500/5 px-2 py-1">
              <span className="text-[10px] uppercase tracking-wider text-fuchsia-400">
                Watch
              </span>
              <p className="text-xs text-foreground/90 mt-0.5">
                {advice.keyNote}
              </p>
            </div>
          )}

          {/* Free-form commentary */}
          {advice.commentary && (
            <p className="text-[11px] text-muted-foreground italic">
              {advice.commentary}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
