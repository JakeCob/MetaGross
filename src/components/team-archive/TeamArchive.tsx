"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { PokemonSprite } from "@/components/pokemon-sprite";
import type { CreatorTeam } from "@/lib/data/creator-teams";
import { ACTIVE_REGULATION_LABEL } from "@/lib/data/champions";

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

interface TournamentTeamMember {
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
  team: TournamentTeamMember[];
}

interface Creator {
  name: string;
  handle: string;
  url: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Meta Templates (hardcoded cores from meta-teams.md)
// ---------------------------------------------------------------------------

const META_TEMPLATES = [
  {
    name: "Rain",
    emoji: "🌧️",
    core: ["Pelipper", "Archaludon", "Basculegion", "Dragonite"],
    tier: "A",
    description:
      "Weather control + rain-boosted water/electric moves",
    winCondition:
      "Get rain up, boost Archaludon's Stamina, spam Electro Shot + CB Wave Crash",
  },
  {
    name: "Sun",
    emoji: "☀️",
    core: ["Charizard", "Venusaur", "Whimsicott", "Incineroar"],
    tier: "A",
    description: "Drought + Chlorophyll sweepers",
    winCondition: "Sun up, Chlorophyll abusers clean",
  },
  {
    name: "Sand",
    emoji: "🏜️",
    core: ["Tyranitar", "Excadrill", "Garchomp", "Incineroar"],
    tier: "S (vs Rain)",
    description: "Sand Stream + Sand Rush speed abuse",
    winCondition:
      "Excadrill wins speed war in sand, KOs with Earthquake + Iron Head",
  },
  {
    name: "Snow",
    emoji: "❄️",
    core: ["Ninetales-Alola", "Froslass", "Glaceon", "Corviknight"],
    tier: "B+",
    description: "Snow Warning + Aurora Veil + Slush Rush",
    winCondition:
      "Set snow, Aurora Veil screens, Slush Rush abusers sweep",
  },
  {
    name: "Trick Room",
    emoji: "🔮",
    core: ["Farigiraf", "Sinistcha", "Dondozo", "Incineroar"],
    tier: "A",
    description: "TR setter + slow heavy attackers",
    winCondition: "Set TR, slow attackers sweep",
  },
  {
    name: "Hyper Offense",
    emoji: "⚔️",
    core: ["Dragapult", "Sneasler", "Metagross", "Kingambit"],
    tier: "S",
    description: "Fast pressure + priority",
    winCondition: "Overwhelm before opponent sets up",
  },
] as const;

const CREATOR_ARCHETYPES = [
  "All",
  "Rain",
  "Sun",
  "Sand",
  "Snow",
  "Trick Room",
  "Hyper Offense",
  "Balance",
  "Perish Song Control",
] as const;

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

function isMega(species: string): boolean {
  return /mega/i.test(species);
}

function getPlacementColor(placement: number): string {
  if (placement === 1) return "bg-amber-400 text-amber-950";
  if (placement === 2) return "bg-slate-300 text-slate-950";
  if (placement <= 4) return "bg-amber-600/70 text-amber-100";
  if (placement <= 8) return "bg-slate-500 text-slate-100";
  return "bg-slate-700 text-slate-300";
}

/** Convert a creator team to Showdown-style pokepaste text. */
function creatorTeamToPokepaste(team: CreatorTeam): string {
  return team.pokemon
    .map((p) => {
      const lines: string[] = [];
      const itemPart = p.item ? ` @ ${p.item}` : "";
      lines.push(`${p.species}${itemPart}`);
      if (p.ability) lines.push(`Ability: ${p.ability}`);
      lines.push(`Level: 50`);
      if (p.tera) lines.push(`Tera Type: ${p.tera}`);
      if (p.nature) lines.push(`${p.nature} Nature`);
      for (const move of p.moves) {
        if (move) lines.push(`- ${move}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Tab 1: Tournament Winners
// ---------------------------------------------------------------------------

function TournamentTeamMemberChip({ mon }: { mon: TournamentTeamMember }) {
  return (
    <div className="rounded-lg bg-card/60 border border-border/40 p-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <PokemonSprite
          species={mon.species}
          mega={isMega(mon.species)}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-foreground truncate">
            {mon.species}
          </div>
          {mon.tera && (
            <div className="text-[9px] text-muted-foreground">
              Tera {mon.tera}
            </div>
          )}
        </div>
      </div>
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
      {mon.moves.length > 0 && (
        <div className="flex flex-wrap gap-1">
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
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-[10px] font-bold shrink-0 ${getPlacementColor(standing.placement)}`}
        >
          {standing.placement}
        </span>
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
        {hasTeam && !expanded && (
          <div className="hidden sm:flex gap-0.5 shrink-0 items-center">
            {standing.team.slice(0, 6).map((mon) => (
              <PokemonSprite
                key={mon.species}
                species={mon.species}
                mega={isMega(mon.species)}
                size={28}
              />
            ))}
          </div>
        )}
        {hasTeam && (
          <span className="text-muted-foreground text-xs shrink-0">
            {expanded ? "\u25B2" : "\u25BC"}
          </span>
        )}
      </button>
      {expanded && hasTeam && (
        <div className="px-3 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {standing.team.map((mon) => (
              <TournamentTeamMemberChip key={mon.species} mon={mon} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const [standings, setStandings] = useState<Standing[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const loadStandings = useCallback(async () => {
    if (standings !== null) {
      setExpanded((p) => !p);
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
      console.error(err);
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }, [tournament.id, standings]);

  const toggleRow = useCallback((placement: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(placement)) next.delete(placement);
      else next.add(placement);
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
                <Badge variant="secondary" className="text-[10px] font-mono">
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
      {expanded && standings !== null && (
        <CardContent className="pt-0 px-0">
          {standings.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground text-center">
              No standings data available.
            </p>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              {standings.slice(0, 8).map((s) => (
                <StandingRow
                  key={`${s.placement}-${s.name}`}
                  standing={s}
                  expanded={expandedRows.has(s.placement)}
                  onToggle={() => toggleRow(s.placement)}
                />
              ))}
              {standings.length > 8 && (
                <p className="text-center text-xs text-muted-foreground py-2">
                  Showing top 8 of {standings.length} standings
                </p>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function TournamentWinnersTab() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tournaments")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load tournaments");
        return r.json();
      })
      .then((data: { tournaments: Tournament[] }) => {
        if (!cancelled) {
          setTournaments(data.tournaments ?? []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">
          Tournament Winners
        </h2>
        <p className="text-sm text-muted-foreground">
          Real teams from Limitless {ACTIVE_REGULATION_LABEL} tournaments. Click a
          tournament for the top 8 standings and full team lists.
        </p>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card
              key={i}
              className="bg-card/80 backdrop-blur-sm border-border/50"
            >
              <CardHeader className="pb-3">
                <div className="h-4 w-48 rounded bg-muted animate-pulse" />
                <div className="h-3 w-24 rounded bg-muted animate-pulse mt-1.5" />
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      )}

      {!loading && !error && tournaments.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No tournament data available.
          </CardContent>
        </Card>
      )}

      {!loading && !error && tournaments.length > 0 && (
        <div className="flex flex-col gap-3">
          {tournaments.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Meta Templates
// ---------------------------------------------------------------------------

function TemplateCard({
  template,
}: {
  template: (typeof META_TEMPLATES)[number];
}) {
  const coreParam = template.core.join(",");
  const buildHref = `/teams/new?core=${encodeURIComponent(coreParam)}&name=${encodeURIComponent(`${template.name} Team`)}`;

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="text-xl">{template.emoji}</span>
            {template.name}
          </CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30"
          >
            {template.tier}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {template.description}
        </p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1">
          {template.core.map((species) => (
            <div
              key={species}
              className="flex flex-col items-center gap-0.5 rounded-md bg-muted/30 px-2 py-1.5"
              title={species}
            >
              <PokemonSprite
                species={species}
                mega={isMega(species)}
                size={48}
              />
              <span className="text-[10px] text-muted-foreground leading-tight text-center">
                {species}
              </span>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground border-l-2 border-amber-500/40 pl-2">
          <span className="text-foreground/70 font-medium">Win condition: </span>
          {template.winCondition}
        </div>
        <Link href={buildHref} className="mt-auto">
          <Button size="sm" className="w-full">
            Build From This
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function MetaTemplatesTab() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">
          Meta Templates
        </h2>
        <p className="text-sm text-muted-foreground">
          Curated archetype cores for {ACTIVE_REGULATION_LABEL}. Pick one to pre-fill
          a new team with the key Pokemon.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {META_TEMPLATES.map((t) => (
          <TemplateCard key={t.name} template={t} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Creator Teams
// ---------------------------------------------------------------------------

function CreatorTeamCard({ team }: { team: CreatorTeam }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      const paste = creatorTeamToPokepaste(team);
      await navigator.clipboard.writeText(paste);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("Failed to copy pokepaste", err);
    }
  }, [team]);

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-semibold text-foreground leading-tight">
              {team.title}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1 text-xs">
              {team.creatorUrl ? (
                <a
                  href={team.creatorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  {team.creatorHandle}
                </a>
              ) : (
                <span className="text-foreground/80 font-medium">
                  {team.creatorHandle}
                </span>
              )}
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {formatDate(team.date)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge
              variant="outline"
              className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30"
            >
              {team.archetype}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-mono">
              {team.format}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* Sprites row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {team.pokemon.map((p) => (
            <div
              key={p.species}
              className="flex flex-col items-center gap-0.5"
              title={p.species}
            >
              <PokemonSprite
                species={p.species}
                mega={isMega(p.species)}
                size={44}
              />
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground leading-snug">
          {team.description}
        </p>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide Team" : "View Team"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy as Pokepaste"}
          </Button>
          {team.videoUrl && (
            <a href={team.videoUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm">
                Watch Video
              </Button>
            </a>
          )}
        </div>

        {/* Expanded full sets */}
        {expanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {team.pokemon.map((p) => (
              <div
                key={p.species}
                className="rounded-lg bg-card/60 border border-border/40 p-2.5 flex flex-col gap-1.5"
              >
                <div className="flex items-center gap-2">
                  <PokemonSprite
                    species={p.species}
                    mega={isMega(p.species)}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-foreground truncate">
                      {p.species}
                    </div>
                    {p.tera && (
                      <div className="text-[9px] text-muted-foreground">
                        Tera {p.tera}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                  <div>
                    <span className="text-foreground/50">Ability:</span>{" "}
                    <span className="text-foreground/80">{p.ability}</span>
                  </div>
                  <div>
                    <span className="text-foreground/50">Item:</span>{" "}
                    <span className="text-foreground/80">{p.item}</span>
                  </div>
                  {p.nature && (
                    <div>
                      <span className="text-foreground/50">Nature:</span>{" "}
                      <span className="text-foreground/80">{p.nature}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {p.moves.map((m) => (
                    <Badge
                      key={m}
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 text-foreground/70 border-border/40"
                    >
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Strategy */}
        {expanded && team.strategy && (
          <div className="text-[11px] text-muted-foreground border-l-2 border-amber-500/40 pl-2 mt-1">
            <span className="text-foreground/70 font-medium">Strategy: </span>
            {team.strategy}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreatorsListSection({ creators }: { creators: Creator[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-foreground">Creators</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {creators.map((c) => (
          <Card
            key={c.handle}
            className="bg-card/80 backdrop-blur-sm border-border/50"
          >
            <CardContent className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {c.name}
                </span>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  {c.handle}
                </a>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                {c.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CreatorTeamsTab() {
  const [teams, setTeams] = useState<CreatorTeam[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [archetypeFilter, setArchetypeFilter] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/team-archive/creators")
      .then((r) => r.json())
      .then((data: { teams: CreatorTeam[]; creators: Creator[] }) => {
        if (!cancelled) {
          setTeams(data.teams ?? []);
          setCreators(data.creators ?? []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      if (selectedCreator && t.creator !== selectedCreator) return false;
      if (archetypeFilter !== "All") {
        if (!t.archetype.toLowerCase().includes(archetypeFilter.toLowerCase())) {
          return false;
        }
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const inTitle = t.title.toLowerCase().includes(q);
        const inCreator = t.creator.toLowerCase().includes(q);
        const inSpecies = t.pokemon.some((p) =>
          p.species.toLowerCase().includes(q),
        );
        if (!inTitle && !inCreator && !inSpecies) return false;
      }
      return true;
    });
  }, [teams, selectedCreator, archetypeFilter, searchTerm]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">
          Creator Teams
        </h2>
        <p className="text-sm text-muted-foreground">
          Hand-picked teams from top VGC content creators. Always credit the
          creator when using their build.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        {/* Creator chips */}
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={selectedCreator === null ? "default" : "outline"}
            size="xs"
            onClick={() => setSelectedCreator(null)}
          >
            All creators
          </Button>
          {creators.map((c) => (
            <Button
              key={c.handle}
              variant={selectedCreator === c.name ? "default" : "outline"}
              size="xs"
              onClick={() =>
                setSelectedCreator((prev) => (prev === c.name ? null : c.name))
              }
            >
              {c.name}
            </Button>
          ))}
        </div>

        {/* Archetype + search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Archetype:</span>
            <Select
              value={archetypeFilter}
              onValueChange={(v: string | null) => {
                if (v) setArchetypeFilter(v);
              }}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREATOR_ARCHETYPES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search teams, creators, Pokemon..."
            className="h-8 max-w-xs"
          />
        </div>
      </div>

      {/* Teams grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-muted-foreground">Loading teams...</span>
        </div>
      ) : filteredTeams.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No teams match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredTeams.map((t) => (
            <CreatorTeamCard key={t.id} team={t} />
          ))}
        </div>
      )}

      {/* Creators list */}
      {!loading && creators.length > 0 && (
        <CreatorsListSection creators={creators} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TeamArchive() {
  const [tab, setTab] = useState("winners");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Team Archive
        </h1>
        <p className="text-sm text-muted-foreground">
          Browse real tournament-winning teams, meta archetype templates, and
          curated builds from top VGC creators.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
        <TabsList>
          <TabsTrigger value="winners">Tournament Winners</TabsTrigger>
          <TabsTrigger value="templates">Meta Templates</TabsTrigger>
          <TabsTrigger value="creators">Creator Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="winners" className="pt-4">
          <TournamentWinnersTab />
        </TabsContent>

        <TabsContent value="templates" className="pt-4">
          <MetaTemplatesTab />
        </TabsContent>

        <TabsContent value="creators" className="pt-4">
          <CreatorTeamsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
