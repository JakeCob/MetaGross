"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TeamPokemon, EVSpread } from "@/lib/types/pokemon";

// ---------------------------------------------------------------------------
// Types for the debate steps displayed in the UI
// ---------------------------------------------------------------------------
interface DebateStep {
  id: string;
  label: string;
  agent: string;
  content: string;
  status: "pending" | "active" | "done";
}

interface SimResult {
  threat: string;
  survives: boolean;
  damageRange: string;
  speedComparison: string;
}

interface DebateResult {
  spread: EVSpread;
  nature: string;
  moves: string[];
  ability: string;
  item: string;
  reasoning: string;
  wolfeComment: string;
  cybertronComment: string;
  initialBenchmarks: SimResult[];
  benchmarks: SimResult[];
  iterations: number;
}

/** Full optimized set applied back to the team editor. */
export interface FinalSet {
  spread: EVSpread;
  nature: string;
  moves: string[];
  ability: string;
  item: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface EVDebatePanelProps {
  pokemon: TeamPokemon;
  team: TeamPokemon[];
  format?: string;
  /**
   * Called when the user accepts the debated set.
   * Receives the full set (moves/ability/item as well as spread/nature).
   * The legacy (spread, nature) shape remains supported via an overload-
   * style call — we always pass both so older callers still work.
   */
  onComplete?: (spread: EVSpread, nature: string, full?: FinalSet) => void;
}

// ---------------------------------------------------------------------------
// Single row of the before/after set diff.
// ---------------------------------------------------------------------------
function SetRow({
  label,
  from,
  to,
}: {
  label: string;
  from: string;
  to: string;
}) {
  const changed = (from ?? "").trim() !== (to ?? "").trim();
  return (
    <>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground self-center">
        {label}
      </span>
      <div className="flex flex-col gap-0.5">
        {changed ? (
          <>
            <span className="text-rose-400 line-through decoration-rose-400/60">
              {from || "(unset)"}
            </span>
            <span className="text-emerald-300">{to || "(unset)"}</span>
          </>
        ) : (
          <span className="text-foreground/80">{to || "(unset)"}</span>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function EVDebatePanel({
  pokemon,
  team,
  format = "champions-reg-m-a",
  onComplete,
}: EVDebatePanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<DebateStep[]>([]);
  const [result, setResult] = useState<DebateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runDebate = useCallback(async () => {
    setIsRunning(true);
    setSteps([]);
    setResult(null);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ev-debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pokemon, team, format }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          (errData as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from the buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // Keep incomplete last line in buffer

        let eventType = "";
        let dataStr = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            dataStr = line.slice(6);

            if (!eventType || !dataStr) continue;

            try {
              const data = JSON.parse(dataStr) as Record<string, unknown>;
              handleSSEEvent(eventType, data);
            } catch {
              // Skip malformed JSON
            }

            eventType = "";
            dataStr = "";
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message ?? "Unknown error");
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [pokemon, team, format]);

  const handleSSEEvent = useCallback(
    (event: string, data: Record<string, unknown>) => {
      if (event === "start") {
        setSteps([]);
      } else if (event === "node") {
        const node = data.node as string;
        const nodeData = (data.data ?? {}) as Record<string, unknown>;

        const agentLabels: Record<string, { label: string; agent: string }> = {
          simulate_initial: { label: "Simulator (baseline)", agent: "simulator" },
          propose: { label: "Spread Specialist", agent: "specialist" },
          wolfe: { label: "Wolfe Glick", agent: "wolfe" },
          cybertron: { label: "CybertronVGC", agent: "cybertron" },
          simulate: { label: "Simulator (post-debate)", agent: "simulator" },
          finalize: { label: "Final Decision", agent: "finalize" },
        };

        const meta = agentLabels[node] ?? {
          label: node,
          agent: node,
        };

        let content = "";
        if (node === "propose") {
          const s = nodeData.currentSpread as EVSpread | undefined;
          const n = nodeData.currentNature as string | undefined;
          const mv = (nodeData.currentMoves as string[] | undefined)?.filter(Boolean) ?? [];
          const ab = nodeData.currentAbility as string | undefined;
          const it = nodeData.currentItem as string | undefined;
          const lines: string[] = [];
          if (ab) lines.push(`Ability: ${ab}`);
          if (it) lines.push(`Item: ${it}`);
          if (mv.length) lines.push(`Moves: ${mv.join(" / ")}`);
          if (s) {
            lines.push(
              `${n ?? "Hardy"}: HP ${s.hp} / Atk ${s.atk} / Def ${s.def} / SpA ${s.spa} / SpD ${s.spd} / Spe ${s.spe}`,
            );
          }
          content = lines.join("\n");
        } else if (node === "wolfe") {
          content = (nodeData.wolfeReview as string) ?? "";
        } else if (node === "cybertron") {
          content = (nodeData.cybertronReview as string) ?? "";
        } else if (node === "simulate_initial") {
          const sims = (nodeData.initialSimulationResults as SimResult[]) ?? [];
          content = sims.length
            ? `Baseline (your current set):\n${sims
                .map(
                  (r) =>
                    `${r.survives ? "OK" : "FAIL"} vs ${r.threat}: ${r.damageRange}, ${r.speedComparison}`,
                )
                .join("\n")}`
            : "Baseline simulation complete.";
        } else if (node === "simulate") {
          const sims = (nodeData.simulationResults as SimResult[]) ?? [];
          content = sims
            .map(
              (r) =>
                `${r.survives ? "OK" : "FAIL"} vs ${r.threat}: ${r.damageRange}, ${r.speedComparison}`,
            )
            .join("\n");
        } else if (node === "finalize") {
          const s = nodeData.finalSpread as EVSpread | undefined;
          const n = nodeData.finalNature as string | undefined;
          const r = nodeData.finalReasoning as string | undefined;
          const mv = (nodeData.finalMoves as string[] | undefined)?.filter(Boolean) ?? [];
          const ab = nodeData.finalAbility as string | undefined;
          const it = nodeData.finalItem as string | undefined;
          const lines: string[] = [];
          if (ab) lines.push(`Ability: ${ab}`);
          if (it) lines.push(`Item: ${it}`);
          if (mv.length) lines.push(`Moves: ${mv.join(" / ")}`);
          if (s) {
            lines.push(
              `${n ?? "Hardy"}: HP ${s.hp} / Atk ${s.atk} / Def ${s.def} / SpA ${s.spa} / SpD ${s.spd} / Spe ${s.spe}`,
            );
          }
          if (r) lines.push("", r);
          content = lines.join("\n");
        }

        setSteps((prev) => {
          // Mark previous steps as done
          const updated = prev.map((s) =>
            s.status === "active" ? { ...s, status: "done" as const } : s,
          );
          return [
            ...updated,
            {
              id: `${node}-${Date.now()}`,
              label: meta.label,
              agent: meta.agent,
              content,
              status: "done",
            },
          ];
        });
      } else if (event === "done") {
        const r: DebateResult = {
          spread: data.spread as EVSpread,
          nature: (data.nature as string) ?? "Hardy",
          moves: (data.moves as string[]) ?? ["", "", "", ""],
          ability: (data.ability as string) ?? "",
          item: (data.item as string) ?? "",
          reasoning: (data.reasoning as string) ?? "",
          wolfeComment: (data.wolfeComment as string) ?? "",
          cybertronComment: (data.cybertronComment as string) ?? "",
          initialBenchmarks: (data.initialBenchmarks as SimResult[]) ?? [],
          benchmarks: (data.benchmarks as SimResult[]) ?? [],
          iterations: (data.iterations as number) ?? 1,
        };
        setResult(r);
      } else if (event === "error") {
        setError((data.message as string) ?? "Unknown error");
      }
    },
    [],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleApply = useCallback(() => {
    if (result && onComplete) {
      const paddedMoves = [...result.moves, "", "", "", ""].slice(0, 4);
      onComplete(result.spread, result.nature, {
        spread: result.spread,
        nature: result.nature,
        moves: paddedMoves,
        ability: result.ability,
        item: result.item,
      });
    }
  }, [result, onComplete]);

  const agentIcons: Record<string, string> = {
    specialist: "[CALC]",
    wolfe: "[W]",
    cybertron: "[CY]",
    simulator: "[SIM]",
    finalize: "[OK]",
  };

  const agentColors: Record<string, string> = {
    specialist: "text-blue-400",
    wolfe: "text-orange-400",
    cybertron: "text-purple-400",
    simulator: "text-cyan-400",
    finalize: "text-green-400",
  };

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>AI EV Optimizer</span>
          {!isRunning && !result && (
            <Button
              size="sm"
              onClick={runDebate}
              disabled={!pokemon.species}
            >
              Optimize {pokemon.species || "Pokemon"}
            </Button>
          )}
          {isRunning && (
            <Button size="sm" variant="destructive" onClick={handleCancel}>
              Cancel
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {/* Loading indicator */}
        {isRunning && steps.length === 0 && (
          <div className="text-sm text-muted-foreground animate-pulse">
            Starting EV optimization for {pokemon.species}...
          </div>
        )}

        {/* Debate steps */}
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex gap-2 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <span
              className={`shrink-0 font-mono text-xs font-bold ${agentColors[step.agent] ?? "text-foreground"}`}
            >
              {agentIcons[step.agent] ?? "[?]"}
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-medium text-foreground">
                {step.label}
              </span>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words font-sans">
                {step.content}
              </pre>
            </div>
          </div>
        ))}

        {/* Error state */}
        {error && (
          <div className="text-sm text-destructive">
            Error: {error}
          </div>
        )}

        {/* Result with simulation table */}
        {result && (
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <Badge variant="success" className="text-xs">
                Final Set
              </Badge>
              <span className="text-xs text-muted-foreground">
                {result.iterations} iteration{result.iterations !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Set diff block */}
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-mono rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <SetRow
                label="Ability"
                from={pokemon.ability}
                to={result.ability || pokemon.ability}
              />
              <SetRow
                label="Item"
                from={pokemon.item}
                to={result.item || pokemon.item}
              />
              <SetRow
                label="Moves"
                from={pokemon.moves.filter(Boolean).join(" / ")}
                to={result.moves.filter(Boolean).join(" / ")}
              />
              <SetRow
                label="Nature"
                from={pokemon.nature}
                to={result.nature}
              />
              <SetRow
                label="Spread"
                from={`HP ${pokemon.evs.hp} / Atk ${pokemon.evs.atk} / Def ${pokemon.evs.def} / SpA ${pokemon.evs.spa} / SpD ${pokemon.evs.spd} / Spe ${pokemon.evs.spe}`}
                to={`HP ${result.spread.hp} / Atk ${result.spread.atk} / Def ${result.spread.def} / SpA ${result.spread.spa} / SpD ${result.spread.spd} / Spe ${result.spread.spe}`}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {result.reasoning}
            </p>

            {/* Benchmark summary */}
            {result.benchmarks.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground">
                  Benchmarks ({result.benchmarks.filter((b) => b.survives).length}/{result.benchmarks.length} passed)
                </span>
                <div className="flex flex-wrap gap-1">
                  {result.benchmarks.map((b, i) => (
                    <Badge
                      key={i}
                      variant={b.survives ? "success" : "error"}
                      className="text-[10px]"
                    >
                      {b.survives ? "OK" : "FAIL"} vs {b.threat}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleApply}>
                Apply full set to team
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={runDebate}
              >
                Re-run
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
