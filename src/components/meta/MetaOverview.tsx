"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { UsageStatsCard } from "./UsageStatsCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormatOption {
  id: string;
  label: string;
  source: "pikalytics" | "smogon";
}

interface SourceBreakdown {
  pikalytics?: { usage: number };
  limitless?: { usage: number; appearances: number; totalTeams: number };
  smogon?: { usage: number };
}

interface TopPokemon {
  species: string;
  usage: number;
  rank?: number;
  sources?: SourceBreakdown;
}

interface PokemonDetail {
  species: string;
  moves: { name: string; usage: number; sources?: string[] }[];
  abilities: { name: string; usage: number; sources?: string[] }[];
  items: { name: string; usage: number; sources?: string[] }[];
  teammates: { name: string; usage: number; sources?: string[] }[];
  source: string;
  dataSources?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRankColor(rank: number): string {
  if (rank <= 3) return "bg-amber-400 text-amber-950"; // gold
  if (rank <= 10) return "bg-slate-400 text-slate-950"; // silver
  return "bg-slate-600 text-slate-200"; // gray
}

function getUsageBarColor(usage: number): string {
  if (usage >= 30) return "from-blue-500 to-blue-400";
  if (usage >= 15) return "from-blue-500/80 to-blue-400/60";
  if (usage >= 8) return "from-slate-400 to-slate-500";
  return "from-slate-500 to-slate-600";
}

const SOURCE_COLORS: Record<string, string> = {
  pikalytics: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  limitless: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  smogon: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

function SourceBadge({ source }: { source: string }) {
  const label =
    source === "pikalytics"
      ? "Pikalytics"
      : source === "limitless"
        ? "Limitless"
        : source === "smogon"
          ? "Smogon"
          : source;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${SOURCE_COLORS[source] ?? "bg-muted text-muted-foreground border-border"}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// SourceTooltip — per-source breakdown on hover
// ---------------------------------------------------------------------------

function SourceBreakdownTooltip({ sources }: { sources?: SourceBreakdown }) {
  if (!sources) return null;
  const entries = Object.entries(sources) as [string, Record<string, number>][];
  if (entries.length === 0) return null;

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <div className="rounded-lg bg-popover border border-border shadow-lg px-3 py-2 text-[10px] whitespace-nowrap">
        {sources.pikalytics && (
          <div className="flex items-center gap-2 justify-between">
            <span className="text-blue-400">Pikalytics</span>
            <span className="font-mono text-foreground">
              {sources.pikalytics.usage.toFixed(1)}%
            </span>
          </div>
        )}
        {sources.limitless && (
          <div className="flex items-center gap-2 justify-between">
            <span className="text-amber-400">Limitless</span>
            <span className="font-mono text-foreground">
              {sources.limitless.usage.toFixed(1)}%
            </span>
          </div>
        )}
        {sources.smogon && (
          <div className="flex items-center gap-2 justify-between">
            <span className="text-emerald-400">Smogon</span>
            <span className="font-mono text-foreground">
              {sources.smogon.usage.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PokemonCard - individual card in the grid
// ---------------------------------------------------------------------------

function PokemonCard({
  pokemon,
  maxUsage,
  isSelected,
  onClick,
  detail,
  detailLoading,
}: {
  pokemon: TopPokemon;
  maxUsage: number;
  isSelected: boolean;
  onClick: () => void;
  detail: PokemonDetail | null;
  detailLoading: boolean;
}) {
  const rank = pokemon.rank ?? 0;
  const usageWidth = maxUsage > 0 ? (pokemon.usage / maxUsage) * 100 : 0;

  // Determine which source badges to show
  const activeSources = pokemon.sources
    ? Object.keys(pokemon.sources)
    : [];

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left cursor-pointer w-full"
    >
      <Card
        className={`relative transition-all duration-200 bg-card/80 backdrop-blur-sm border-border/50 hover:ring-2 hover:ring-primary/40 hover:bg-card/95 ${
          isSelected ? "ring-2 ring-primary bg-card/95" : ""
        }`}
      >
        {/* Rank badge */}
        <div className="absolute top-2.5 left-3">
          <span
            className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[10px] font-bold ${getRankColor(rank)}`}
          >
            {rank}
          </span>
        </div>

        <CardContent className="pt-5 pb-3 px-3 flex flex-col gap-2.5">
          {/* Species name + usage */}
          <div className="flex items-start justify-between pl-8">
            <span className="text-sm font-semibold text-foreground leading-tight">
              {pokemon.species}
            </span>
            <div className="relative group shrink-0 ml-1">
              <span className="text-xs font-mono text-muted-foreground cursor-default">
                {pokemon.usage.toFixed(1)}%
              </span>
              <SourceBreakdownTooltip sources={pokemon.sources} />
            </div>
          </div>

          {/* Source badges */}
          {activeSources.length > 0 && (
            <div className="flex gap-1 pl-8">
              {activeSources.map((s) => (
                <SourceBadge key={s} source={s} />
              ))}
            </div>
          )}

          {/* Usage bar */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${getUsageBarColor(pokemon.usage)} transition-all duration-500`}
              style={{ width: `${usageWidth}%` }}
            />
          </div>

          {/* Quick stats preview (moves, item, ability) */}
          {detailLoading && (
            <div className="flex flex-col gap-1 mt-0.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-3 rounded bg-muted animate-pulse"
                  style={{ width: `${80 - i * 12}%` }}
                />
              ))}
            </div>
          )}

          {detail && !detailLoading && (
            <div className="flex flex-col gap-2 mt-0.5">
              {/* Top 4 moves with mini bars */}
              {detail.moves.slice(0, 4).length > 0 && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                    Moves
                  </span>
                  {detail.moves.slice(0, 4).map((m) => (
                    <MiniBar
                      key={m.name}
                      name={m.name}
                      value={m.usage}
                      max={detail.moves[0]?.usage ?? 100}
                    />
                  ))}
                </div>
              )}

              {/* Top item */}
              {detail.items[0] && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Item</span>
                  <span className="font-mono text-foreground/80">
                    {detail.items[0].name}{" "}
                    <span className="text-muted-foreground">
                      {detail.items[0].usage.toFixed(1)}%
                    </span>
                  </span>
                </div>
              )}

              {/* Top ability */}
              {detail.abilities[0] && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Ability</span>
                  <span className="font-mono text-foreground/80">
                    {detail.abilities[0].name}{" "}
                    <span className="text-muted-foreground">
                      {detail.abilities[0].usage.toFixed(1)}%
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </button>
  );
}

// ---------------------------------------------------------------------------
// MiniBar — compact horizontal bar for move usage in card preview
// ---------------------------------------------------------------------------

function MiniBar({
  name,
  value,
  max,
}: {
  name: string;
  value: number;
  max: number;
}) {
  const width = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-[5.5rem] shrink-0 truncate text-[10px] text-foreground/70" title={name}>
        {name}
      </span>
      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/50 transition-all duration-300"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-[9px] font-mono text-muted-foreground">
        {value.toFixed(0)}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton card for loading
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardContent className="pt-5 pb-3 px-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-1.5 rounded-full bg-muted animate-pulse" />
        <div className="flex flex-col gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-3 rounded bg-muted animate-pulse"
              style={{ width: `${85 - i * 10}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// MetaOverview (main component)
// ---------------------------------------------------------------------------

export function MetaOverview() {
  const [format, setFormat] = useState("championspreview");
  const [formats, setFormats] = useState<FormatOption[]>([]);
  const [pokemon, setPokemon] = useState<TopPokemon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
  const [dataSources, setDataSources] = useState<string[]>([]);

  // Cache of fetched detail data for card previews
  const [detailCache, setDetailCache] = useState<
    Record<string, PokemonDetail>
  >({});
  const [detailLoading, setDetailLoading] = useState<Set<string>>(new Set());

  // Ref-based fetch functions that avoid synchronous setState in effects
  const detailCacheRef = useRef(detailCache);
  detailCacheRef.current = detailCache;

  const fetchDetail = useCallback(
    (species: string, fmt: string) => {
      if (detailCacheRef.current[species]) return;

      setDetailLoading((prev) => {
        if (prev.has(species)) return prev;
        return new Set(prev).add(species);
      });

      fetch(
        `/api/pokemon/usage?species=${encodeURIComponent(species)}&format=${encodeURIComponent(fmt)}`,
      )
        .then((r) => {
          if (!r.ok) throw new Error("Not found");
          return r.json();
        })
        .then((data: PokemonDetail) => {
          setDetailCache((prev) => ({ ...prev, [species]: data }));
          setDetailLoading((prev) => {
            const next = new Set(prev);
            next.delete(species);
            return next;
          });
        })
        .catch(() => {
          setDetailLoading((prev) => {
            const next = new Set(prev);
            next.delete(species);
            return next;
          });
        });
    },
    [],
  );

  // Fetch available formats on mount
  useEffect(() => {
    fetch("/api/pokemon/usage?formats=true")
      .then((r) => r.json())
      .then((data: { formats: FormatOption[] }) => {
        if (data.formats?.length) setFormats(data.formats);
      })
      .catch(() => {
        setFormats([
          { id: "championspreview", label: "Champions Reg M-A (Current)", source: "pikalytics" },
        ]);
      });
  }, []);

  // Fetch top usage whenever format changes
  useEffect(() => {
    let cancelled = false;

    const loadUsage = async () => {
      try {
        const r = await fetch(
          `/api/pokemon/usage?format=${encodeURIComponent(format)}&top=50`,
        );
        if (!r.ok) throw new Error("Failed to load usage data");
        const data: {
          format: string;
          pokemon: TopPokemon[];
          source: string;
          dataSources?: string[];
        } = await r.json();

        if (cancelled) return;

        const ranked = (data.pokemon ?? []).map((p, i) => ({
          ...p,
          rank: p.rank ?? i + 1,
        }));
        setPokemon(ranked);
        setDataSources(data.dataSources ?? [data.source]);
        setLoading(false);

        // Preload details for top 12 Pokemon
        ranked.slice(0, 12).forEach((p) => {
          fetchDetail(p.species, format);
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setPokemon([]);
        setDataSources([]);
        setLoading(false);
      }
    };

    // Reset state before fetch
    setPokemon([]);
    setLoading(true);
    setError(null);
    setSelectedSpecies(null);
    setDetailCache({});
    setDetailLoading(new Set());
    setDataSources([]);

    // Schedule the async fetch
    loadUsage();

    return () => {
      cancelled = true;
    };
  }, [format, fetchDetail]);

  const handleFormatChange = useCallback((val: string | null) => {
    if (val) setFormat(val);
  }, []);

  const handleCardClick = useCallback(
    (species: string) => {
      setSelectedSpecies((prev) => (prev === species ? null : species));
      fetchDetail(species, format);
    },
    [fetchDetail, format],
  );

  // Get the label for current format
  const currentFormatLabel =
    formats.find((f) => f.id === format)?.label ?? format;

  const maxUsage = pokemon[0]?.usage ?? 100;

  const sourceLabel = dataSources.length > 0
    ? dataSources
        .map((s) =>
          s === "pikalytics"
            ? "Pikalytics"
            : s === "limitless"
              ? "Limitless VGC"
              : s === "smogon"
                ? "Smogon"
                : s,
        )
        .join(", ")
    : "Pikalytics";

  return (
    <div className="flex flex-col gap-8">
      {/* Hero header */}
      <div className="flex flex-col gap-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              {currentFormatLabel.replace(" (Current)", "")} Meta
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {dataSources.length > 1
                ? `Aggregated data from ${dataSources.length} sources: ${sourceLabel}`
                : `Live usage data from ${sourceLabel}`}
              {" "}— top 50 Pokemon by usage
            </p>
          </div>

          {/* Format selector */}
          <div className="w-64">
            <Select value={format} onValueChange={handleFormatChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formats.length > 0 &&
                  formats.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Data source badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground/70">Data:</span>
          {dataSources.length > 0 ? (
            dataSources.map((s) => (
              <a
                key={s}
                href={
                  s === "pikalytics"
                    ? "https://www.pikalytics.com"
                    : s === "limitless"
                      ? "https://play.limitlesstcg.com"
                      : s === "smogon"
                        ? "https://www.smogon.com"
                        : "#"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-80"
              >
                <SourceBadge source={s} />
              </a>
            ))
          ) : (
            <a
              href="https://www.pikalytics.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-muted-foreground/70 underline decoration-muted-foreground/30 hover:text-muted-foreground transition-colors"
            >
              Pikalytics (pikalytics.com)
            </a>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {error}. Try selecting a different format.
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Pokemon grid */}
      {!loading && !error && pokemon.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pokemon.map((p) => (
            <PokemonCard
              key={p.species}
              pokemon={p}
              maxUsage={maxUsage}
              isSelected={selectedSpecies === p.species}
              onClick={() => handleCardClick(p.species)}
              detail={detailCache[p.species] ?? null}
              detailLoading={detailLoading.has(p.species)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && pokemon.length === 0 && (
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No usage data available for this format.
          </CardContent>
        </Card>
      )}

      {/* Expanded detail view */}
      {selectedSpecies && (
        <div className="mt-2">
          <UsageStatsCard species={selectedSpecies} format={format} />
        </div>
      )}

      {/* Data source badge */}
      {!loading && pokemon.length > 0 && (
        <div className="flex justify-center">
          <Badge variant="outline" className="text-[10px] text-muted-foreground/60">
            {pokemon.length} Pokemon loaded
          </Badge>
        </div>
      )}
    </div>
  );
}
