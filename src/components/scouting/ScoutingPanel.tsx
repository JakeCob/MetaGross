"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PokemonSprite } from "@/components/pokemon-sprite";
import { useBattleLogger } from "@/stores/use-battle-logger";
import { useScoutingRunner } from "@/hooks/use-scouting-runner";

/**
 * Phase-2 ScoutingPanel — bare render of the predicted-set + synthesis
 * output from /api/opponent-scouting. Styling is intentionally minimal;
 * polish + interactivity (editable win conditions, lead apply buttons)
 * land in Phases 4–6.
 */
export function ScoutingPanel() {
  const store = useBattleLogger();
  const { run, cancel, status, result } = useScoutingRunner();

  const hasOpponentTeam = store.opponentTeam.length > 0;

  return (
    <Card className="bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Opponent Scouting</span>
          <div className="flex items-center gap-2">
            {status === "running" && (
              <Badge variant="info" className="text-[10px] animate-pulse">
                Analyzing…
              </Badge>
            )}
            {status === "done" && (
              <Badge variant="success" className="text-[10px]">
                Ready
              </Badge>
            )}
            {status === "error" && (
              <Badge variant="error" className="text-[10px]">
                Error
              </Badge>
            )}
            {status === "running" ? (
              <Button size="sm" variant="destructive" onClick={cancel}>
                Cancel
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => run({ forceRefresh: status === "done" })}
                disabled={!hasOpponentTeam}
              >
                {status === "done" ? "Re-run" : "Analyze"}
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {!hasOpponentTeam && (
          <p className="text-sm text-muted-foreground">
            Enter the opponent&apos;s team first — the analyzer needs at least
            the revealed species.
          </p>
        )}

        {hasOpponentTeam && !result && status !== "running" && (
          <p className="text-sm text-muted-foreground">
            Click <strong>Analyze</strong> to scout the opponent&apos;s
            archetype, predict their sets, and get lead + win-condition
            recommendations.
          </p>
        )}

        {result && (
          <>
            {/* Archetype / synergies */}
            <section className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Archetype
                </span>
                <Badge variant="outline" className="text-xs">
                  {result.archetype || "unknown"}
                </Badge>
              </div>
              {result.teamSynergies.length > 0 && (
                <ul className="text-xs text-muted-foreground list-disc list-inside">
                  {result.teamSynergies.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </section>

            {/* Predicted sets */}
            {result.predictedSets.length > 0 && (
              <section className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Predicted sets
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {result.predictedSets.map((set, i) => (
                    <div
                      key={`${set.species}-${i}`}
                      className="rounded-md border border-border/50 bg-muted/20 p-2 flex gap-2"
                    >
                      <PokemonSprite species={set.species} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">
                            {set.species}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {Math.round(set.confidence * 100)}%
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {set.ability || "(ability?)"} · {set.item || "(item?)"}
                        </div>
                        <div className="text-[11px] text-foreground/80 truncate">
                          {set.moves.filter(Boolean).join(" / ") || "(moves?)"}
                        </div>
                        {set.rationale && (
                          <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                            {set.rationale}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Suggested leads */}
            {result.suggestedLeads.length > 0 && (
              <section className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Lead recommendation
                </span>
                {result.suggestedLeads.map((lead, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-primary/30 bg-primary/5 p-2"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {lead.pair.map((sp) => (
                        <div key={sp} className="flex items-center gap-1">
                          <PokemonSprite species={sp} size={28} />
                          <span className="text-xs font-medium">{sp}</span>
                        </div>
                      ))}
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        score {lead.score}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{lead.rationale}</p>
                    <p className="text-xs text-foreground/90 mt-1">{lead.gamePlan}</p>
                  </div>
                ))}
              </section>
            )}

            {/* Watch-fors */}
            {result.watchFor.length > 0 && (
              <section className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Watch for
                </span>
                <ul className="text-xs text-foreground/90 list-disc list-inside">
                  {result.watchFor.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* Persona notes */}
            {(result.wolfeNote || result.cybertronNote) && (
              <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {result.wolfeNote && (
                  <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-orange-400 mb-1">
                      Wolfe
                    </div>
                    <p className="text-xs text-foreground/90">{result.wolfeNote}</p>
                  </div>
                )}
                {result.cybertronNote && (
                  <div className="rounded-md border border-purple-500/30 bg-purple-500/5 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-purple-400 mb-1">
                      Cybertron
                    </div>
                    <p className="text-xs text-foreground/90">
                      {result.cybertronNote}
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* Agent-suggested win conditions (read-only for now) */}
            {result.suggestedWinConditions.length > 0 && (
              <section className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Suggested win conditions
                </span>
                <ul className="text-xs text-foreground/90 list-disc list-inside">
                  {result.suggestedWinConditions.map((wc) => (
                    <li key={wc.id}>
                      {wc.label}
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        ({wc.kind})
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-muted-foreground">
                  Editable checklist lands in Phase 4.
                </p>
              </section>
            )}

            {/* Synthesis */}
            {result.synthesis && (
              <section>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Synthesis
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  {result.synthesis}
                </p>
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
