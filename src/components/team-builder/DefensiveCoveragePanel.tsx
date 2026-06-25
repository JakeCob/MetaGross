"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PokemonSprite } from "@/components/pokemon-sprite";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { TeamCoverage } from "@/lib/pokemon/type-coverage";
import { multiplierLabel } from "@/lib/pokemon/type-chart";

const TYPE_COLORS: Record<string, string> = {
  Normal: "bg-gray-500 text-white",
  Fire: "bg-orange-600 text-white",
  Water: "bg-blue-500 text-white",
  Electric: "bg-yellow-400 text-black",
  Grass: "bg-green-500 text-white",
  Ice: "bg-cyan-300 text-black",
  Fighting: "bg-red-700 text-white",
  Poison: "bg-purple-600 text-white",
  Ground: "bg-amber-700 text-white",
  Flying: "bg-indigo-300 text-black",
  Psychic: "bg-pink-500 text-white",
  Bug: "bg-lime-600 text-white",
  Rock: "bg-yellow-800 text-white",
  Ghost: "bg-purple-800 text-white",
  Dragon: "bg-violet-700 text-white",
  Dark: "bg-gray-800 text-white",
  Steel: "bg-gray-400 text-black",
  Fairy: "bg-pink-300 text-black",
};

/** Cell background by defensive multiplier. */
function cellClass(m: number): string {
  if (m === 0) return "bg-sky-600/30 text-sky-300"; // immune
  if (m === 0.25) return "bg-emerald-600/40 text-emerald-200";
  if (m === 0.5) return "bg-emerald-600/20 text-emerald-300";
  if (m === 2) return "bg-rose-600/25 text-rose-300";
  if (m === 4) return "bg-rose-600/50 text-rose-100 font-semibold";
  return "text-muted-foreground/40"; // neutral ×1
}

function TypeChip({ type }: { type: string }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
        TYPE_COLORS[type] ?? "bg-muted text-foreground"
      }`}
    >
      {type}
    </span>
  );
}

function toMarkdown(cov: TeamCoverage): string {
  const lines = ["## Defensive coverage"];
  if (cov.sharedWeaknesses.length > 0) {
    const parts = cov.sharedWeaknesses.map((t) => {
      const row = cov.rows.find((r) => r.type === t);
      return `${t} (${row?.weak ?? 0} weak${row?.critical ? ", uncovered" : ""})`;
    });
    lines.push(`Shared weaknesses: ${parts.join(", ")}`);
  } else {
    lines.push("No shared weaknesses (≥3 members weak to one type).");
  }
  const offenders = cov.rows.filter((r) => r.weak > 0);
  for (const r of offenders) {
    lines.push(
      `- ${r.type}: ${r.weak} weak / ${r.resist} resist / ${r.immune} immune`,
    );
  }
  return lines.join("\n");
}

export interface DefensiveCoveragePanelProps {
  team: Partial<TeamPokemon>[];
  /** Report a markdown section for the builder's "Export analysis". */
  onMarkdown?: (md: string | null) => void;
}

export function DefensiveCoveragePanel({ team, onMarkdown }: DefensiveCoveragePanelProps) {
  const [open, setOpen] = useState(true);
  const [coverage, setCoverage] = useState<TeamCoverage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable key over the filled species + abilities so we only refetch when the
  // typing-relevant inputs actually change (not on every EV/move keystroke).
  const sig = useMemo(
    () =>
      team
        .filter((p) => p.species?.trim())
        .map((p) => `${p.species!.trim()}:${p.ability?.trim() ?? ""}`)
        .join("|"),
    [team],
  );
  const filledCount = sig ? sig.split("|").length : 0;

  const onMarkdownRef = useRef(onMarkdown);
  useEffect(() => {
    onMarkdownRef.current = onMarkdown;
  }, [onMarkdown]);

  useEffect(() => {
    if (!sig) {
      setCoverage(null);
      onMarkdownRef.current?.(null);
      return;
    }
    let cancelled = false;
    const payload = team
      .filter((p) => p.species?.trim())
      .map((p) => ({ species: p.species!.trim(), ability: p.ability?.trim() || undefined }));

    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      fetch("/api/pokemon/coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: payload }),
      })
        .then(async (res) => {
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
          if (cancelled) return;
          setCoverage(j.coverage as TeamCoverage);
          onMarkdownRef.current?.(toMarkdown(j.coverage as TeamCoverage));
        })
        .catch((e) => {
          if (!cancelled) setError((e as Error).message ?? "Failed to compute coverage");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // `team` is captured fresh via the closure; `sig` gates the refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return (
    <Card size="sm" className="bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            🛡️ Defensive coverage
            <span className="text-[10px] font-normal text-muted-foreground">
              type weaknesses across your team
            </span>
          </span>
          <Button size="xs" variant="outline" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide" : "Open"}
          </Button>
        </CardTitle>
      </CardHeader>

      {open && (
        <CardContent className="flex flex-col gap-3 pt-0">
          {filledCount === 0 && (
            <p className="text-[10px] text-muted-foreground">
              Add Pokémon to see the team&apos;s defensive type coverage.
            </p>
          )}
          {loading && <p className="text-[10px] text-muted-foreground">Computing…</p>}
          {error && <div className="text-xs text-destructive">{error}</div>}

          {coverage && coverage.members.length > 0 && (
            <>
              {/* Shared-weakness callout */}
              {coverage.sharedWeaknesses.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5">
                  <span className="text-[10px] font-semibold text-rose-300">
                    ⚠ Shared weakness:
                  </span>
                  {coverage.sharedWeaknesses.map((t) => {
                    const row = coverage.rows.find((r) => r.type === t)!;
                    return (
                      <span key={t} className="inline-flex items-center gap-1">
                        <TypeChip type={t} />
                        <span className="text-[9px] text-rose-300/80">
                          {row.weak} weak{row.critical ? " · uncovered" : ""}
                        </span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-medium text-emerald-300">
                  ✓ No type hits 3+ of your team — coverage is well spread.
                </div>
              )}

              {/* Matrix */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-center">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-card px-1 py-1 text-left text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Atk ↓
                      </th>
                      {coverage.members.map((m) => (
                        <th key={m.species} className="px-0.5 py-1">
                          <div className="flex flex-col items-center gap-0.5" title={`${m.species} — ${m.types.join("/")}`}>
                            <PokemonSprite species={m.species} size={24} />
                          </div>
                        </th>
                      ))}
                      <th className="px-1 py-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Weak
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverage.rows.map((row) => (
                      <tr
                        key={row.type}
                        className={row.shared ? "bg-rose-500/5" : undefined}
                      >
                        <td className="sticky left-0 z-10 bg-card px-1 py-0.5 text-left">
                          <TypeChip type={row.type} />
                        </td>
                        {coverage.members.map((m) => {
                          const v = m.multipliers[row.type];
                          return (
                            <td key={m.species} className="px-0.5 py-0.5">
                              <span
                                className={`inline-flex h-5 min-w-[26px] items-center justify-center rounded text-[9px] ${cellClass(v)}`}
                              >
                                {v === 1 ? "·" : multiplierLabel(v)}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-1 py-0.5">
                          <span
                            className={`text-[10px] font-semibold ${
                              row.critical
                                ? "text-rose-400"
                                : row.shared
                                  ? "text-amber-400"
                                  : "text-muted-foreground/60"
                            }`}
                          >
                            {row.weak || "–"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[9px] italic text-muted-foreground/70">
                Based on each Pokémon&apos;s base typing + ability immunities (Levitate,
                Flash Fire, etc.). Mega forms use base typing. ⚠ flags a type ≥3 members are weak to.
              </p>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
