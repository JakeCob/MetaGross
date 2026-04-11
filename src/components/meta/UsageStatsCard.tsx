"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types (aligned with aggregated detail response)
// ---------------------------------------------------------------------------

interface UsageEntry {
  name: string;
  usage: number;
  sources?: string[];
}

interface FeaturedTeam {
  player: string;
  record: string;
  pokemon: string[];
  set?: {
    ability: string;
    item: string;
    moves: string[];
  };
}

interface TournamentTeam {
  player: string;
  placement: number;
  team: string[];
}

interface PokemonDetailStats {
  species: string;
  format?: string;
  dataDate?: string;
  usagePercent?: number;
  moves: UsageEntry[];
  items: UsageEntry[];
  abilities: UsageEntry[];
  teammates: UsageEntry[];
  featuredTeams?: FeaturedTeam[];
  tournamentTeams?: TournamentTeam[];
  teraTypes?: UsageEntry[];
  // Smogon-only fields
  spreads?: { spread: string; usage: number }[];
  source: string;
  dataSources?: string[];
}

// ---------------------------------------------------------------------------
// Source badge helpers
// ---------------------------------------------------------------------------

const SOURCE_COLORS: Record<string, string> = {
  pikalytics: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  limitless: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  smogon: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  aggregated: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

function SourceBadge({ source }: { source: string }) {
  const label =
    source === "pikalytics"
      ? "Pikalytics"
      : source === "limitless"
        ? "Limitless"
        : source === "smogon"
          ? "Smogon"
          : source === "aggregated"
            ? "Aggregated"
            : source;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${SOURCE_COLORS[source] ?? "bg-muted text-muted-foreground border-border"}`}
    >
      via {label}
    </span>
  );
}

/** Tiny inline source tags for individual data entries. */
function InlineSources({ sources }: { sources?: string[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <span className="ml-1 text-[8px] text-muted-foreground/50">
      ({sources.map((s) => s === "pikalytics" ? "P" : s === "limitless" ? "L" : s === "smogon" ? "S" : s).join("+")})
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UsageBar({
  name,
  usage,
  maxUsage,
  sources,
}: {
  name: string;
  usage: number;
  maxUsage: number;
  sources?: string[];
}) {
  const width = maxUsage > 0 ? (usage / maxUsage) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-32 shrink-0 truncate text-xs text-foreground"
        title={name}
      >
        {name}
        <InlineSources sources={sources} />
      </span>
      <div className="flex-1 h-4 rounded-sm bg-muted overflow-hidden">
        <div
          className="h-full rounded-sm bg-gradient-to-r from-primary/70 to-primary/40 transition-all duration-300"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="w-14 shrink-0 text-right text-xs font-mono text-muted-foreground">
        {usage.toFixed(1)}%
      </span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  );
}

function TeammatesBadges({
  teammates,
  onTeammateClick,
}: {
  teammates: UsageEntry[];
  onTeammateClick?: (species: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {teammates.map((t) => (
        <button
          key={t.name}
          type="button"
          onClick={() => onTeammateClick?.(t.name)}
          className="cursor-pointer transition-colors"
        >
          <Badge
            variant="outline"
            className="text-xs hover:bg-primary/10 hover:border-primary/40 transition-colors"
          >
            {t.name}
            <span className="ml-1 text-muted-foreground">
              {t.usage.toFixed(1)}%
            </span>
            <InlineSources sources={t.sources} />
          </Badge>
        </button>
      ))}
    </div>
  );
}

function FeaturedTeamCard({ team }: { team: FeaturedTeam }) {
  return (
    <div className="rounded-lg bg-muted/30 border border-border/30 p-3 flex flex-col gap-2">
      {/* Player name + record */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          {team.player}
        </span>
        <Badge variant="secondary" className="text-[10px] font-mono">
          {team.record}
        </Badge>
      </div>

      {/* Team composition */}
      <div className="flex flex-wrap gap-1">
        {team.pokemon.map((mon) => (
          <Badge
            key={mon}
            variant="outline"
            className="text-[10px] px-1.5 py-0"
          >
            {mon}
          </Badge>
        ))}
      </div>

      {/* Set details */}
      {team.set && (
        <div className="mt-1 text-[11px] text-muted-foreground space-y-0.5">
          {team.set.ability && (
            <div>
              <span className="text-foreground/60">Ability:</span>{" "}
              <span className="text-foreground/80">{team.set.ability}</span>
            </div>
          )}
          {team.set.item && (
            <div>
              <span className="text-foreground/60">Item:</span>{" "}
              <span className="text-foreground/80">{team.set.item}</span>
            </div>
          )}
          {team.set.moves.length > 0 && (
            <div>
              <span className="text-foreground/60">Moves:</span>{" "}
              <span className="text-foreground/80">
                {team.set.moves.join(" / ")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TournamentTeamCard({ team }: { team: TournamentTeam }) {
  return (
    <div className="rounded-lg bg-muted/30 border border-amber-500/20 p-3 flex flex-col gap-2">
      {/* Player name + placement */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          {team.player}
        </span>
        <Badge
          variant="secondary"
          className="text-[10px] font-mono bg-amber-500/15 text-amber-400"
        >
          #{team.placement}
        </Badge>
      </div>

      {/* Team composition */}
      <div className="flex flex-wrap gap-1">
        {team.team.map((mon) => (
          <Badge
            key={mon}
            variant="outline"
            className="text-[10px] px-1.5 py-0"
          >
            {mon}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function UsageStatsSkeleton() {
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader>
        <div className="h-5 w-48 rounded bg-muted animate-pulse" />
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-3 w-16 rounded bg-muted animate-pulse" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-4 w-full rounded bg-muted animate-pulse" />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tera type colors
// ---------------------------------------------------------------------------

const TERA_COLORS: Record<string, string> = {
  Normal: "bg-gray-500/20 text-gray-400",
  Fire: "bg-orange-600/20 text-orange-400",
  Water: "bg-blue-500/20 text-blue-400",
  Electric: "bg-yellow-400/20 text-yellow-300",
  Grass: "bg-green-500/20 text-green-400",
  Ice: "bg-cyan-300/20 text-cyan-300",
  Fighting: "bg-red-700/20 text-red-400",
  Poison: "bg-purple-600/20 text-purple-400",
  Ground: "bg-amber-700/20 text-amber-400",
  Flying: "bg-indigo-300/20 text-indigo-300",
  Psychic: "bg-pink-500/20 text-pink-400",
  Bug: "bg-lime-600/20 text-lime-400",
  Rock: "bg-yellow-800/20 text-yellow-600",
  Ghost: "bg-purple-800/20 text-purple-300",
  Dragon: "bg-violet-700/20 text-violet-400",
  Dark: "bg-gray-800/20 text-gray-300",
  Steel: "bg-gray-400/20 text-gray-300",
  Fairy: "bg-pink-300/20 text-pink-300",
  Stellar:
    "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface UsageStatsCardProps {
  /** Pokemon species name */
  species: string;
  /** Format ID (e.g. "championspreview" or "gen9vgc2025") */
  format?: string;
  /** If true, shows compact layout (for embedding in team builder) */
  compact?: boolean;
}

export function UsageStatsCard({
  species,
  format = "championspreview",
  compact = false,
}: UsageStatsCardProps) {
  const [fetchState, setFetchState] = useState<{
    stats: PokemonDetailStats | null;
    loading: boolean;
    error: string | null;
    key: string;
  }>({ stats: null, loading: true, error: null, key: `${species}:${format}` });

  // Derive whether we need to start a new fetch
  const currentKey = `${species}:${format}`;
  const needsRefetch = fetchState.key !== currentKey;

  // Reset state when key changes (derived, not in effect)
  const stats = needsRefetch ? null : fetchState.stats;
  const loading = needsRefetch ? true : fetchState.loading;
  const error = needsRefetch ? null : fetchState.error;

  useEffect(() => {
    if (!species) return;

    let cancelled = false;
    const key = `${species}:${format}`;

    const load = async () => {
      try {
        const r = await fetch(
          `/api/pokemon/usage?species=${encodeURIComponent(species)}&format=${encodeURIComponent(format)}`,
        );
        if (!r.ok) throw new Error("No data found");
        const data: PokemonDetailStats = await r.json();
        if (!cancelled) {
          setFetchState({ stats: data, loading: false, error: null, key });
        }
      } catch (err) {
        if (!cancelled) {
          setFetchState({
            stats: null,
            loading: false,
            error: err instanceof Error ? err.message : "Unknown error",
            key,
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [species, format]);

  if (loading) return <UsageStatsSkeleton />;

  if (error || !stats) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          {error
            ? `No data found for ${species}`
            : "No usage data available"}
        </CardContent>
      </Card>
    );
  }

  const isAggregated = stats.source === "aggregated";
  const activeSources = stats.dataSources ?? [stats.source];
  const movesLimit = compact ? 5 : 10;
  const moves = stats.moves.slice(0, movesLimit);
  const maxMoveUsage = moves[0]?.usage ?? 1;
  const items = stats.items.slice(0, compact ? 3 : 10);
  const maxItemUsage = items[0]?.usage ?? 1;
  const abilities = stats.abilities.slice(0, 5);
  const maxAbilityUsage = abilities[0]?.usage ?? 1;
  const featuredTeams = stats.featuredTeams?.slice(0, compact ? 3 : 10) ?? [];
  const tournamentTeams = stats.tournamentTeams?.slice(0, compact ? 3 : 10) ?? [];

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 flex-wrap">
          <span className="text-lg">{stats.species}</span>
          {stats.usagePercent != null && (
            <Badge variant="secondary" className="font-mono text-xs">
              {stats.usagePercent.toFixed(1)}% usage
            </Badge>
          )}
          {stats.dataDate && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {stats.dataDate}
            </Badge>
          )}
          {/* Source badges */}
          {activeSources.map((s) => (
            <SourceBadge key={s} source={s} />
          ))}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* Moves */}
        {moves.length > 0 && (
          <Section title="Moves">
            <div className="flex flex-col gap-1">
              {moves.map((m) => (
                <UsageBar
                  key={m.name}
                  name={m.name}
                  usage={m.usage}
                  maxUsage={maxMoveUsage}
                  sources={isAggregated ? m.sources : undefined}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Items */}
        {items.length > 0 && (
          <Section title="Items">
            <div className="flex flex-col gap-1">
              {items.map((item) => (
                <UsageBar
                  key={item.name}
                  name={item.name}
                  usage={item.usage}
                  maxUsage={maxItemUsage}
                  sources={isAggregated ? item.sources : undefined}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Abilities */}
        {abilities.length > 0 && (
          <Section title="Abilities">
            <div className="flex flex-col gap-1">
              {abilities.map((a) => (
                <UsageBar
                  key={a.name}
                  name={a.name}
                  usage={a.usage}
                  maxUsage={maxAbilityUsage}
                  sources={isAggregated ? a.sources : undefined}
                />
              ))}
            </div>
          </Section>
        )}

        {/* EV Spreads (Smogon only) */}
        {stats.spreads && stats.spreads.length > 0 && !compact && (
          <Section title="EV Spreads">
            <div className="flex flex-col gap-1.5">
              {stats.spreads.slice(0, 5).map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5"
                >
                  <span className="text-xs font-mono text-foreground">
                    {s.spread}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {(s.usage * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Tera Types */}
        {stats.teraTypes &&
          stats.teraTypes.length > 0 &&
          !compact && (
            <Section title="Tera Types">
              <div className="flex flex-wrap gap-1.5">
                {stats.teraTypes.map((t) => {
                  // Usage from tournament data is already in % form; Smogon is 0-1
                  const displayUsage = t.usage > 1 ? t.usage : t.usage * 100;
                  return (
                    <Badge
                      key={t.name}
                      className={`text-[10px] px-2 py-0.5 ${TERA_COLORS[t.name] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {t.name} {displayUsage.toFixed(0)}%
                      {isAggregated && t.sources && (
                        <InlineSources sources={t.sources} />
                      )}
                    </Badge>
                  );
                })}
              </div>
            </Section>
          )}

        {/* Teammates */}
        {stats.teammates.length > 0 && !compact && (
          <Section title="Common Teammates">
            <TeammatesBadges teammates={stats.teammates} />
          </Section>
        )}

        {/* Tournament Results (Limitless) */}
        {tournamentTeams.length > 0 && !compact && (
          <Section title="Recent Tournament Results">
            <p className="text-[10px] text-muted-foreground/60 -mt-0.5 mb-1">
              Top placements from Limitless VGC tournament data
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {tournamentTeams.map((team, i) => (
                <TournamentTeamCard key={i} team={team} />
              ))}
            </div>
          </Section>
        )}

        {/* Featured Teams (Pikalytics) */}
        {featuredTeams.length > 0 && !compact && (
          <Section title="Featured Teams">
            <p className="text-[10px] text-muted-foreground/60 -mt-0.5 mb-1">
              Featured team reports via Pikalytics
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {featuredTeams.map((team, i) => (
                <FeaturedTeamCard key={i} team={team} />
              ))}
            </div>
          </Section>
        )}
      </CardContent>
    </Card>
  );
}
