"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Tournament {
  id: string;
  name: string;
  date: string;
  format: string;
  players: number;
}

interface TeamMember {
  species: string;
  item: string;
  ability: string;
  moves: string[];
  tera: string;
}

interface Standing {
  name: string;
  country: string;
  placement: number;
  team: TeamMember[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getPlacementColor(placement: number): string {
  if (placement === 1) return "bg-amber-400 text-amber-950";
  if (placement === 2) return "bg-slate-300 text-slate-950";
  if (placement <= 4) return "bg-amber-600/70 text-amber-100";
  if (placement <= 8) return "bg-slate-500 text-slate-100";
  return "bg-slate-700 text-slate-300";
}

const TERA_COLORS: Record<string, string> = {
  Normal: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  Fire: "bg-orange-600/20 text-orange-400 border-orange-600/30",
  Water: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Electric: "bg-yellow-400/20 text-yellow-300 border-yellow-400/30",
  Grass: "bg-green-500/20 text-green-400 border-green-500/30",
  Ice: "bg-cyan-300/20 text-cyan-300 border-cyan-300/30",
  Fighting: "bg-red-700/20 text-red-400 border-red-700/30",
  Poison: "bg-purple-600/20 text-purple-400 border-purple-600/30",
  Ground: "bg-amber-700/20 text-amber-400 border-amber-700/30",
  Flying: "bg-indigo-300/20 text-indigo-300 border-indigo-300/30",
  Psychic: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  Bug: "bg-lime-600/20 text-lime-400 border-lime-600/30",
  Rock: "bg-yellow-800/20 text-yellow-600 border-yellow-800/30",
  Ghost: "bg-purple-800/20 text-purple-300 border-purple-800/30",
  Dragon: "bg-violet-700/20 text-violet-400 border-violet-700/30",
  Dark: "bg-gray-800/20 text-gray-300 border-gray-800/30",
  Steel: "bg-gray-400/20 text-gray-300 border-gray-400/30",
  Fairy: "bg-pink-300/20 text-pink-300 border-pink-300/30",
  Stellar: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

// ---------------------------------------------------------------------------
// TeamMemberCard — detailed view of a single Pokemon on a team
// ---------------------------------------------------------------------------

function TeamMemberCard({ mon }: { mon: TeamMember }) {
  const teraClass =
    TERA_COLORS[mon.tera] ?? "bg-muted text-muted-foreground border-border";

  return (
    <div className="rounded-lg bg-card/60 border border-border/40 p-2.5 flex flex-col gap-1.5">
      {/* Species + Tera */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">
          {mon.species}
        </span>
        {mon.tera && (
          <span
            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${teraClass}`}
          >
            Tera {mon.tera}
          </span>
        )}
      </div>

      {/* Item + Ability */}
      <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
        {mon.ability && (
          <div>
            <span className="text-foreground/50">Ability:</span>{" "}
            <span className="text-foreground/80">{mon.ability}</span>
          </div>
        )}
        {mon.item && (
          <div>
            <span className="text-foreground/50">Item:</span>{" "}
            <span className="text-foreground/80">{mon.item}</span>
          </div>
        )}
      </div>

      {/* Moves */}
      {mon.moves.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {mon.moves.map((move) => (
            <Badge
              key={move}
              variant="outline"
              className="text-[9px] px-1.5 py-0 text-foreground/70 border-border/40"
            >
              {move}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StandingRow — a single player's placement + team
// ---------------------------------------------------------------------------

function StandingRow({
  standing,
  expanded,
  onToggle,
}: {
  standing: Standing;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasTeam = standing.team.length > 0;

  return (
    <div className="border-b border-border/30 last:border-b-0">
      <button
        type="button"
        onClick={hasTeam ? onToggle : undefined}
        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors ${
          hasTeam
            ? "cursor-pointer hover:bg-muted/30"
            : "cursor-default opacity-70"
        }`}
      >
        {/* Placement */}
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-[10px] font-bold shrink-0 ${getPlacementColor(standing.placement)}`}
        >
          {standing.placement}
        </span>

        {/* Player name + country */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground truncate block">
            {standing.name}
          </span>
        </div>

        {standing.country && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {standing.country}
          </span>
        )}

        {/* Team species preview (compact) */}
        {hasTeam && !expanded && (
          <div className="hidden sm:flex gap-1 shrink-0">
            {standing.team.slice(0, 6).map((mon) => (
              <Badge
                key={mon.species}
                variant="outline"
                className="text-[9px] px-1 py-0"
              >
                {mon.species}
              </Badge>
            ))}
          </div>
        )}

        {/* Expand indicator */}
        {hasTeam && (
          <span className="text-muted-foreground text-xs shrink-0">
            {expanded ? "\u25B2" : "\u25BC"}
          </span>
        )}
      </button>

      {/* Expanded team details */}
      {expanded && hasTeam && (
        <div className="px-3 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {standing.team.map((mon) => (
              <TeamMemberCard key={mon.species} mon={mon} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TournamentCard — a single tournament with expandable standings
// ---------------------------------------------------------------------------

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const [standings, setStandings] = useState<Standing[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedStandings, setExpandedStandings] = useState<Set<number>>(
    new Set(),
  );

  const loadStandings = useCallback(async () => {
    if (standings !== null) {
      setExpanded((prev) => !prev);
      return;
    }

    setLoading(true);
    try {
      const r = await fetch(
        `/api/tournaments?id=${encodeURIComponent(tournament.id)}`,
      );
      if (!r.ok) throw new Error("Failed to load standings");
      const data: { standings: Standing[] } = await r.json();
      setStandings(data.standings ?? []);
      setExpanded(true);
    } catch (err) {
      console.error("Failed to load standings:", err);
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }, [tournament.id, standings]);

  const toggleStandingExpand = useCallback((placement: number) => {
    setExpandedStandings((prev) => {
      const next = new Set(prev);
      if (next.has(placement)) {
        next.delete(placement);
      } else {
        next.add(placement);
      }
      return next;
    });
  }, []);

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
      <button
        type="button"
        onClick={loadStandings}
        className="w-full text-left cursor-pointer"
      >
        <CardHeader className="pb-3 hover:bg-muted/20 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-semibold text-foreground leading-tight">
                {tournament.name}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(tournament.date)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {tournament.players > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] font-mono"
                >
                  {tournament.players} players
                </Badge>
              )}
              <Badge
                variant="outline"
                className="text-[9px] bg-amber-500/15 text-amber-400 border-amber-500/30"
              >
                {tournament.format}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {loading ? "..." : expanded ? "\u25B2" : "\u25BC"}
              </span>
            </div>
          </div>
        </CardHeader>
      </button>

      {/* Standings */}
      {expanded && standings !== null && (
        <CardContent className="pt-0 px-0">
          {standings.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground text-center">
              No standings data available for this tournament.
            </p>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              {standings.slice(0, 32).map((s) => (
                <StandingRow
                  key={`${s.placement}-${s.name}`}
                  standing={s}
                  expanded={expandedStandings.has(s.placement)}
                  onToggle={() => toggleStandingExpand(s.placement)}
                />
              ))}
              {standings.length > 32 && (
                <p className="text-center text-xs text-muted-foreground py-2">
                  Showing top 32 of {standings.length} standings
                </p>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TournamentSkeleton() {
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-48 rounded bg-muted animate-pulse" />
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-5 w-20 rounded bg-muted animate-pulse" />
        </div>
      </CardHeader>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TournamentList (main exported component)
// ---------------------------------------------------------------------------

export function TournamentList() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const r = await fetch("/api/tournaments");
        if (!r.ok) throw new Error("Failed to load tournaments");
        const data: { tournaments: Tournament[] } = await r.json();
        if (!cancelled) {
          setTournaments(data.tournaments ?? []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Champions Tournaments
        </h1>
        <p className="text-sm text-muted-foreground">
          Recent VGC Champions Reg M-A tournament results from Limitless VGC.
          Click a tournament to view standings and full team lists.
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-muted-foreground/70">Data:</span>
          <a
            href="https://play.limitlesstcg.com"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-opacity hover:opacity-80"
          >
            <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-medium bg-amber-500/15 text-amber-400 border-amber-500/30">
              Limitless VGC
            </span>
          </a>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <TournamentSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Tournament list */}
      {!loading && !error && tournaments.length > 0 && (
        <div className="flex flex-col gap-3">
          {tournaments.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && tournaments.length === 0 && (
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No tournament data available.
          </CardContent>
        </Card>
      )}

      {/* Attribution */}
      {!loading && tournaments.length > 0 && (
        <div className="flex justify-center">
          <Badge variant="outline" className="text-[10px] text-muted-foreground/60">
            {tournaments.length} tournaments loaded
          </Badge>
        </div>
      )}
    </div>
  );
}
