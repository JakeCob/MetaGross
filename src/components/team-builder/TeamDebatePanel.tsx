"use client";

import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PokemonSprite } from "@/components/pokemon-sprite";

/** One agent turn surfaced in the live transcript. */
interface TranscriptEntry {
  agent: string;
  label: string;
  round: number;
  text: string;
}

interface EVSpread {
  hp: number; atk: number; def: number; spa: number; spd: number; spe: number;
}

interface DraftMember {
  species: string;
  role?: string;
  item?: string;
  ability?: string;
  moves?: string[];
  note?: string;
  nature?: string;
  evs?: EVSpread;
}

interface Violation {
  rule: string;
  severity: "error" | "warning";
  message: string;
}

interface EvProgress {
  done: number;
  total: number;
  optimizing: string[];
}

export interface TeamDebateMember {
  species: string;
  item?: string;
  ability?: string;
  moves?: string[];
  nature?: string;
  evs?: EVSpread;
}

export interface TeamDebatePanelProps {
  /** Filled slots to build around (may be empty → AI picks the whole team). */
  seed: { species: string; item?: string; ability?: string }[];
  format: string;
  /** Replace the builder's team with the debated 6. */
  onApplyTeam: (members: TeamDebateMember[]) => void;
}

/** Per-agent accent so the debate reads like a conversation. */
const AGENT_STYLE: Record<string, { icon: string; color: string }> = {
  propose: { icon: "🧩", color: "text-blue-400" },
  offense: { icon: "⚔️", color: "text-orange-400" },
  defense: { icon: "🛡️", color: "text-cyan-400" },
  analyst: { icon: "📊", color: "text-purple-400" },
  critic: { icon: "⚖️", color: "text-amber-400" },
  finalize: { icon: "✅", color: "text-green-400" },
};

export function TeamDebatePanel({
  seed,
  format,
  onApplyTeam,
}: TeamDebatePanelProps) {
  const [brief, setBrief] = useState("");
  const [mode, setMode] = useState<"ladder" | "tournament">("ladder");
  const [isRunning, setIsRunning] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [team, setTeam] = useState<DraftMember[] | null>(null);
  const [summary, setSummary] = useState("");
  const [violations, setViolations] = useState<Violation[]>([]);
  const [rounds, setRounds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Live EV-optimization progress (the long phase after the 6 agents post).
  const [evProgress, setEvProgress] = useState<EvProgress | null>(null);
  const [evMembers, setEvMembers] = useState<DraftMember[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    setIsRunning(true);
    setTranscript([]);
    setTeam(null);
    setSummary("");
    setViolations([]);
    setError(null);
    setEvProgress(null);
    setEvMembers([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/teams/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed, brief, format, mode }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const ev = chunk.match(/event: (.*)/)?.[1]?.trim();
          const dataStr = chunk.match(/data: ([\s\S]*)/)?.[1];
          if (!ev || !dataStr) continue;
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataStr);
          } catch {
            continue;
          }
          if (ev === "node") {
            const nd = (data.data ?? {}) as Record<string, unknown>;
            const entries = (nd.transcript as TranscriptEntry[]) ?? [];
            if (entries.length) setTranscript((prev) => [...prev, ...entries]);
            // EV-optimization progress (the long phase after the agents post).
            const evp = nd.evProgress as EvProgress | undefined;
            if (evp) {
              setEvProgress(evp);
              const fm = nd.finalTeam as DraftMember[] | undefined;
              if (fm) setEvMembers(fm);
            }
          } else if (ev === "done") {
            setTeam((data.team as DraftMember[]) ?? []);
            setSummary((data.summary as string) ?? "");
            setViolations((data.violations as Violation[]) ?? []);
            setRounds((data.rounds as number) ?? 1);
            setEvProgress(null);
          } else if (ev === "error") {
            setError((data.message as string) ?? "Unknown error");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message ?? "Unknown error");
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [seed, brief, format, mode]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const apply = useCallback(() => {
    if (team) {
      onApplyTeam(
        team.map((m) => ({
          species: m.species,
          item: m.item,
          ability: m.ability,
          moves: m.moves,
          nature: m.nature,
          evs: m.evs,
        })),
      );
    }
  }, [team, onApplyTeam]);

  const warnings = violations.filter((v) => v.severity === "warning");

  return (
    <Card size="sm" className="bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            🧠 AI Team Debate
            <span className="text-[10px] font-normal text-muted-foreground">
              5 agents build &amp; stress-test a team
            </span>
          </span>
          {isRunning ? (
            <Button size="xs" variant="destructive" onClick={cancel}>
              Cancel
            </Button>
          ) : (
            <Button size="xs" onClick={run}>
              {team ? "Re-run" : seed.length ? "Build around my team" : "Build a team"}
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-0">
        {!isRunning && !team && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Building for:</span>
              {(["ladder", "tournament"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize transition-colors ${
                    mode === m
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:bg-accent/40"
                  }`}
                >
                  {m === "ladder" ? "🪜 Ladder" : "🏆 Tournament"}
                </button>
              ))}
              <span className="ml-auto text-[9px] text-muted-foreground/70">
                {mode === "tournament"
                  ? "open sheet → proven teams"
                  : "closed sheet → surprise OK"}
              </span>
            </div>
            <input
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Optional: describe your win condition (e.g. rain hyper offense around Archaludon)"
              className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none focus-visible:border-ring"
            />
          </div>
        )}

        {isRunning && transcript.length === 0 && (
          <div className="animate-pulse text-xs text-muted-foreground">
            Convening the agents…
          </div>
        )}

        {/* Live transcript */}
        {transcript.length > 0 && (
          <div className="flex flex-col gap-2">
            {transcript.map((t, i) => {
              const st = AGENT_STYLE[t.agent] ?? { icon: "•", color: "text-foreground" };
              return (
                <div
                  key={`${t.agent}-${i}`}
                  className="flex gap-2 text-xs animate-in fade-in slide-in-from-bottom-1 duration-300"
                >
                  <span className={`shrink-0 ${st.color}`}>{st.icon}</span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium text-foreground">
                      {t.label}
                      <span className="ml-1 text-[9px] text-muted-foreground">
                        round {t.round}
                      </span>
                    </span>
                    <pre className="whitespace-pre-wrap break-words font-sans text-[11px] leading-snug text-muted-foreground">
                      {t.text}
                    </pre>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Live EV-optimization progress (the long post-debate phase) */}
        {evProgress && !team && (
          <div className="flex flex-col gap-2 border-t border-border pt-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className="text-green-400">🧠</span>
              <span>Optimizing EVs (benchmark sims)</span>
              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                {evProgress.done}/{evProgress.total}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{
                  width: `${evProgress.total ? (evProgress.done / evProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
            {evMembers.length > 0 && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3">
                {evMembers.map((m) => {
                  const isDone = !!m.evs;
                  const isOpt = evProgress.optimizing.includes(m.species);
                  return (
                    <span
                      key={m.species}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground"
                    >
                      <span
                        className={
                          isDone
                            ? "text-green-400"
                            : isOpt
                              ? "animate-pulse text-amber-400"
                              : "text-muted-foreground/40"
                        }
                      >
                        {isDone ? "✓" : isOpt ? "⏳" : "·"}
                      </span>
                      <span className="truncate">
                        {m.species}
                        {m.nature ? ` ${m.nature}` : ""}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
            <p className="text-[9px] text-muted-foreground/60">
              Each Pokémon is benchmarked by the full EV debate — the slow part
              (~10–15 min). 2 run at a time.
            </p>
          </div>
        )}

        {error && <div className="text-xs text-destructive">Error: {error}</div>}

        {/* Final team */}
        {team && team.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <Badge variant="success" className="text-[10px]">
                Final Team
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {rounds} round{rounds !== 1 ? "s" : ""} ·{" "}
                {violations.filter((v) => v.severity === "error").length} blocking issues
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {team.map((m) => (
                <div
                  key={m.species}
                  className="flex items-center gap-2 rounded-md border border-border/50 bg-background/50 px-2 py-1.5"
                >
                  <PokemonSprite species={m.species} size={32} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[11px] font-semibold">
                      {m.species}
                    </span>
                    <span className="truncate text-[9px] text-muted-foreground">
                      {[m.item, m.ability].filter(Boolean).join(" · ") || m.role}
                    </span>
                    {m.nature && (
                      <span className="truncate text-[9px] text-muted-foreground/80">
                        {m.nature} (EVs optimized)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {summary && (
              <p className="text-[11px] leading-snug text-muted-foreground">
                {summary}
              </p>
            )}

            {warnings.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {warnings.map((w, i) => (
                  <span key={i} className="text-[10px] text-amber-400/90">
                    ⚠ {w.message}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button size="xs" onClick={apply}>
                Apply team to builder
              </Button>
              <Button size="xs" variant="outline" onClick={run}>
                Re-run
              </Button>
            </div>
            <p className="text-[9px] text-muted-foreground/60">
              Applying replaces the current slots. EVs + natures are
              benchmark-optimized by the EV debate; fine-tune any slot with the
              per-Pokemon AI EV Optimizer.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
