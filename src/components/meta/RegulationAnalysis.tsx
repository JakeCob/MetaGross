"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PokemonSprite } from "@/components/pokemon-sprite";
import type {
  MbContentBreakdown,
  MbItemEntry,
} from "@/lib/data/regulation-diff";
import type { RegulationInsights } from "@/lib/ai/regulation-analysis";

/** Icon for an item row: the base Pokemon sprite for Mega Stones (no item
 *  icon exists), otherwise the Showdown item icon with a graceful fallback. */
function ItemIcon({ item }: { item: MbItemEntry }) {
  const [failed, setFailed] = useState(false);
  if (item.iconSpecies) {
    return <PokemonSprite species={item.iconSpecies} size={24} />;
  }
  if (failed) {
    return <span className="inline-block h-5 w-5 rounded bg-muted/60" />;
  }
  const id = item.item
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://play.pokemonshowdown.com/sprites/itemicons/${id}.png`}
      alt=""
      width={24}
      height={24}
      style={{ imageRendering: "pixelated" }}
      onError={() => setFailed(true)}
    />
  );
}

export interface RegulationAnalysisProps {
  breakdown: MbContentBreakdown;
  initialInsights: RegulationInsights | null;
  initialCached: boolean;
  aiAvailable: boolean;
}

function TypePills({ types }: { types: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {types.map((t) => (
        <Badge key={t} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
          {t}
        </Badge>
      ))}
    </span>
  );
}

export function RegulationAnalysis({
  breakdown,
  initialInsights,
  initialCached,
  aiAvailable,
}: RegulationAnalysisProps) {
  const [insights, setInsights] = useState<RegulationInsights | null>(
    initialInsights,
  );
  const [cached, setCached] = useState(initialCached);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(refresh: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta/regulation-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      if (data.aiAvailable === false) {
        setError("AI is not configured (set an API key) — showing the factual breakdown only.");
        return;
      }
      setInsights(data.insights);
      setCached(Boolean(data.cached));
    } catch (err) {
      setError((err as Error).message ?? "Failed to generate analysis");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {breakdown.regulation} — Meta Analysis
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What&apos;s new vs {breakdown.previous}, how it shifts the meta, and
            predicted teams.{" "}
            <span className="text-foreground/80">
              {breakdown.counts.species} new Pokemon · {breakdown.counts.megas}{" "}
              new Megas · {breakdown.counts.items} new items
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {insights && (
            <span className="text-[10px] text-muted-foreground">
              {cached ? "cached" : "fresh"} · {insights.model}
            </span>
          )}
          <Button
            size="sm"
            variant={insights ? "outline" : "default"}
            onClick={() => run(Boolean(insights))}
            disabled={loading || !aiAvailable}
            title={
              aiAvailable
                ? "Generate AI meta-impact analysis + predicted teams"
                : "Set an API key to enable AI analysis"
            }
          >
            {loading
              ? "Analyzing…"
              : insights
                ? "↻ Refresh analysis"
                : "✨ Generate analysis"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {error}
        </div>
      )}
      {loading && (
        <div className="rounded-lg border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground">
          Gathering web context + reasoning about the new regulation… (~30s)
        </div>
      )}

      <Tabs defaultValue="impact" className="w-full">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="impact">Meta Impact</TabsTrigger>
          <TabsTrigger value="pokemon">
            New Pokemon ({breakdown.counts.species})
          </TabsTrigger>
          <TabsTrigger value="megas">
            Megas &amp; Abilities ({breakdown.counts.megas})
          </TabsTrigger>
          <TabsTrigger value="items">
            Items ({breakdown.counts.items})
          </TabsTrigger>
          <TabsTrigger value="teams">Predicted Teams</TabsTrigger>
          <TabsTrigger value="adapt">Adapt &amp; Strategy</TabsTrigger>
        </TabsList>

        {/* ---- Meta Impact ---- */}
        <TabsContent value="impact" className="mt-4">
          {!insights ? (
            <EmptyInsights aiAvailable={aiAvailable} />
          ) : (
            <div className="flex flex-col gap-4">
              {insights.summary && (
                <Card size="sm" className="bg-card/60">
                  <CardContent className="pt-4 text-sm leading-relaxed text-foreground/90">
                    {insights.summary}
                  </CardContent>
                </Card>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {insights.metaImpact.map((p) => (
                  <Card key={p.title} size="sm" className="bg-card/60">
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm text-primary">
                        {p.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs leading-relaxed text-muted-foreground">
                      {p.detail}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {insights.spotlights.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Spotlights
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {insights.spotlights.map((s) => (
                      <div
                        key={s.name}
                        className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5"
                      >
                        <PokemonSprite species={s.name} size={28} />
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-foreground">
                            {s.name}
                          </span>
                          <span className="ml-1.5 text-[11px] text-muted-foreground">
                            {s.verdict}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {insights.sources.length > 0 && (
                <div className="text-[10px] text-muted-foreground/70">
                  Sources:{" "}
                  {insights.sources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 && " · "}
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-foreground"
                      >
                        {s.title || s.url}
                      </a>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ---- New Pokemon ---- */}
        <TabsContent value="pokemon" className="mt-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {breakdown.newSpecies.map((s) => (
              <div
                key={s.species}
                className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-card/50 px-2.5 py-2"
              >
                <PokemonSprite species={s.species} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {s.species}
                    </span>
                    {s.unbanned && (
                      <Badge variant="success" className="text-[9px] px-1.5 py-0 h-4">
                        un-banned
                      </Badge>
                    )}
                  </div>
                  <TypePills types={s.types} />
                  <span className="text-[10px] text-muted-foreground">
                    {s.abilities.join(", ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ---- Megas & Abilities ---- */}
        <TabsContent value="megas" className="mt-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {breakdown.newMegas.map((m) => (
              <div
                key={m.mega}
                className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-card/50 px-2.5 py-2"
              >
                <PokemonSprite species={m.mega} mega size={44} />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-foreground">
                    Mega {m.baseSpecies}
                  </span>
                  <TypePills types={m.types} />
                  <div className="text-[10px] text-muted-foreground">
                    <span className="text-foreground/70">{m.stone}</span>
                    {m.ability && (
                      <>
                        {" · "}
                        <span className="text-primary">{m.ability}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ---- Items (table) ---- */}
        <TabsContent value="items" className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-card/60 text-muted-foreground">
                  <th className="w-8 px-2 py-2" />
                  <th className="px-2 py-2 font-medium">Item</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Effect</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.newItems.map((i) => (
                  <tr
                    key={i.item}
                    className="border-b border-border/30 last:border-0 hover:bg-accent/5"
                  >
                    <td className="px-2 py-1.5">
                      <span className="flex h-6 w-6 items-center justify-center">
                        <ItemIcon item={i} />
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-foreground">
                      {i.item}
                    </td>
                    <td className="px-2 py-1.5">
                      <Badge
                        variant={
                          i.status === "unbanned"
                            ? "warning"
                            : i.isStone
                              ? "info"
                              : "secondary"
                        }
                        className="text-[9px] px-1.5 py-0 h-4"
                      >
                        {i.status === "unbanned"
                          ? "un-banned"
                          : i.isStone
                            ? "stone"
                            : "new"}
                      </Badge>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {i.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            <span className="text-amber-300">un-banned</span> = illegal in{" "}
            {breakdown.previous}, legal now ·{" "}
            <span className="text-sky-300">stone</span> = enables a new Mega.
          </p>
        </TabsContent>

        {/* ---- Predicted Teams ---- */}
        <TabsContent value="teams" className="mt-4">
          {!insights ? (
            <EmptyInsights aiAvailable={aiAvailable} />
          ) : insights.predictedTeams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No predicted teams in the latest analysis. Try Refresh.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {insights.predictedTeams.map((t) => (
                <Card key={t.name} size="sm" className="bg-card/60">
                  <CardHeader className="pb-1">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm text-foreground">
                        {t.name}
                      </CardTitle>
                      <Badge variant="info" className="text-[9px] px-1.5 py-0 h-4">
                        {t.archetype}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1">
                      {t.core.map((sp) => (
                        <span
                          key={sp}
                          className="flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[11px]"
                        >
                          <PokemonSprite species={sp} size={20} />
                          {sp}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {t.reasoning}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---- Adapt & Strategy ---- */}
        <TabsContent value="adapt" className="mt-4">
          {!insights ? (
            <EmptyInsights aiAvailable={aiAvailable} />
          ) : (
            <div className="flex flex-col gap-5">
              {(insights.strategies ?? []).length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Strategies for {breakdown.regulation}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {insights.strategies.map((s) => (
                      <Card key={s.title} size="sm" className="bg-card/60">
                        <CardHeader className="pb-1">
                          <CardTitle className="text-sm text-primary">
                            {s.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs leading-relaxed text-muted-foreground">
                          {s.detail}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Upgrade {breakdown.previous} teams → {breakdown.regulation}
                </h3>
                {(insights.adaptations ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No team adaptations in the latest analysis. Try Refresh.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {insights.adaptations.map((a) => (
                      <Card key={a.archetype} size="sm" className="bg-card/60">
                        <CardHeader className="pb-1">
                          <CardTitle className="text-sm text-foreground">
                            {a.archetype}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">
                          {a.baseTeam.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {a.baseTeam.map((sp) => (
                                <span
                                  key={sp}
                                  className="flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[11px]"
                                >
                                  <PokemonSprite species={sp} size={18} />
                                  {sp}
                                </span>
                              ))}
                            </div>
                          )}
                          <ul className="flex flex-col gap-1">
                            {a.changes.map((c, i) => (
                              <li key={i} className="text-[11px] leading-relaxed">
                                <span className="font-medium text-primary">
                                  {c.swap}
                                </span>
                                {c.reasoning && (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    — {c.reasoning}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                          {a.strategy && (
                            <p className="text-[11px] italic text-muted-foreground/90">
                              ▸ {a.strategy}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyInsights({ aiAvailable }: { aiAvailable: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">
        {aiAvailable
          ? "No AI analysis yet. Click ✨ Generate analysis to gather web context + reason about the new regulation."
          : "AI analysis is unavailable (no API key configured). The New Pokemon / Megas / Items tabs still show the full factual breakdown."}
      </p>
    </div>
  );
}
