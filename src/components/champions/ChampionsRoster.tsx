"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PokemonSprite } from "@/components/pokemon-sprite";

// ---------------------------------------------------------------------------
// Types (mirrors /api/champions/roster response)
// ---------------------------------------------------------------------------

interface RosterPokemon {
  species: string;
  types: string[];
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
  };
  canMegaEvolve: boolean;
  megaStone: string | null;
  abilities: string[];
}

interface RosterResponse {
  totalCount: number;
  pokemon: RosterPokemon[];
  items: {
    confirmed: string[];
    uncertain: string[];
  };
  megaEvolutions: Array<{ species: string; stone: string }>;
  noMegaDespiteBase: string[];
  notInChampions: string[];
  rules: {
    totalPoints: number;
    perStatMax: number;
    period: string;
    terastallization: boolean;
    megaEvolution: boolean;
    format: string;
    teamSize: number;
    bring: number;
    level: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const ALL_TYPES = Object.keys(TYPE_COLORS);

const MEGA_STONE_SET = new Set<string>([
  "Charizardite X",
  "Charizardite Y",
  "Venusaurite",
  "Blastoisinite",
  "Garchompite",
  "Gengarite",
  "Tyranitarite",
  "Kangaskhanite",
  "Gyaradosite",
  "Scizorite",
  "Heracronite",
  "Houndoominite",
  "Aerodactylite",
  "Alakazite",
  "Ampharosite",
  "Absolite",
  "Altarianite",
  "Banettite",
  "Beedrillite",
  "Cameruptite",
  "Lopunnite",
  "Lucarionite",
  "Mawilite",
  "Medichamite",
  "Pidgeotite",
  "Pinsirite",
  "Sablenite",
  "Sharpedonite",
  "Slowbronite",
  "Steelixite",
  "Audinite",
  "Meganiumite",
  "Typhlosionite",
  "Feraligatrite",
  "Dragoninite",
  "Excadrillinite",
  "Delphoxite",
  "Greninjaite",
  "Hawluchite",
  "Froslasite",
  "Gardevoirite",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bst(p: RosterPokemon): number {
  const s = p.baseStats;
  return s.hp + s.atk + s.def + s.spa + s.spd + s.spe;
}

function TypeBadge({
  type,
  active,
  onClick,
}: {
  type: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const color = TYPE_COLORS[type] ?? "bg-gray-600 text-white";
  const base = `text-[10px] px-2 py-0 ${color}`;
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium transition-all cursor-pointer ${color} ${
          active
            ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
            : "opacity-70 hover:opacity-100 border-transparent"
        }`}
      >
        {type}
      </button>
    );
  }
  return <Badge className={base}>{type}</Badge>;
}

// ---------------------------------------------------------------------------
// Pokemon card
// ---------------------------------------------------------------------------

function PokemonCard({ pokemon }: { pokemon: RosterPokemon }) {
  const [expanded, setExpanded] = useState(false);
  const total = bst(pokemon);

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50 transition-all hover:ring-2 hover:ring-primary/40">
      <CardContent className="px-3 py-0 flex flex-col gap-2">
        {/* Header: sprite + name + MEGA badge */}
        <div className="flex items-start gap-2">
          <div className="shrink-0">
            <PokemonSprite species={pokemon.species} size={64} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground leading-tight truncate">
                {pokemon.species}
              </h3>
              {pokemon.canMegaEvolve && (
                <Badge
                  variant="warning"
                  className="text-[9px] px-1.5 uppercase tracking-wider shrink-0"
                >
                  Mega
                </Badge>
              )}
            </div>
            {/* Types */}
            <div className="flex flex-wrap gap-1">
              {pokemon.types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
            {/* BST */}
            <div className="text-[10px] font-mono text-muted-foreground">
              BST:{" "}
              <span className="text-foreground/80 font-semibold">{total}</span>
            </div>
          </div>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-6 gap-1 text-center">
          {(["hp", "atk", "def", "spa", "spd", "spe"] as const).map((k) => (
            <div
              key={k}
              className="flex flex-col rounded bg-muted/40 px-1 py-0.5"
              title={k.toUpperCase()}
            >
              <span className="text-[8px] uppercase text-muted-foreground tracking-wider">
                {k}
              </span>
              <span className="text-[11px] font-mono font-medium text-foreground">
                {pokemon.baseStats[k]}
              </span>
            </div>
          ))}
        </div>

        {/* Abilities */}
        <div className="text-[10px] text-muted-foreground">
          <span className="uppercase tracking-wider text-[9px] mr-1">
            Abilities:
          </span>
          <span className="text-foreground/80">
            {pokemon.abilities.join(", ")}
          </span>
        </div>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-[10px] text-primary hover:underline text-left cursor-pointer"
        >
          {expanded ? "Hide details" : "More details"}
        </button>

        {expanded && (
          <div className="flex flex-col gap-2 border-t border-border/50 pt-2">
            {pokemon.canMegaEvolve && pokemon.megaStone && (
              <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-2 py-1">
                <PokemonSprite
                  species={pokemon.species}
                  mega
                  size={40}
                  className="shrink-0"
                />
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-amber-400">
                    Mega {pokemon.species}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    Requires {pokemon.megaStone}
                  </span>
                </div>
              </div>
            )}
            <Link
              href={`/meta?species=${encodeURIComponent(pokemon.species)}`}
              className="text-[10px] text-primary hover:underline"
            >
              View usage data on Meta page →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Mega Evolution card
// ---------------------------------------------------------------------------

function MegaCard({
  species,
  stone,
  baseAbilities,
}: {
  species: string;
  stone: string;
  baseAbilities?: string[];
}) {
  // Extract base name for sprite (e.g., "Charizard-Mega-X" → "Charizard")
  const baseName = species.split("-")[0];

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardContent className="px-3 py-0 flex flex-col gap-2 items-center text-center">
        <PokemonSprite species={species} mega size={72} />
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-foreground">
            Mega {species.replace("-Mega-X", " X").replace("-Mega-Y", " Y").replace("-Mega", "")}
          </h3>
          <span className="text-[10px] text-muted-foreground">
            from {baseName}
          </span>
        </div>
        <Badge
          variant="warning"
          className="text-[9px] px-2 uppercase tracking-wider"
        >
          {stone}
        </Badge>
        {baseAbilities && baseAbilities.length > 0 && (
          <div className="text-[9px] text-muted-foreground">
            Base: {baseAbilities.join(", ")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ChampionsRoster() {
  const [data, setData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [megaOnly, setMegaOnly] = useState(false);
  const [tab, setTab] = useState("pokemon");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/champions/roster")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<RosterResponse>;
      })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load roster");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPokemon = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.pokemon.filter((p) => {
      if (q && !p.species.toLowerCase().includes(q)) return false;
      if (megaOnly && !p.canMegaEvolve) return false;
      if (selectedTypes.size > 0) {
        const hasAny = p.types.some((t) => selectedTypes.has(t));
        if (!hasAny) return false;
      }
      return true;
    });
  }, [data, query, megaOnly, selectedTypes]);

  // Build a lookup for Mega base abilities
  const baseAbilitiesByName = useMemo(() => {
    const m = new Map<string, string[]>();
    if (!data) return m;
    for (const p of data.pokemon) m.set(p.species, p.abilities);
    return m;
  }, [data]);

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-16 rounded-lg bg-muted/40 animate-pulse" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {error ?? "Failed to load the Champions roster."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Hero header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Pokemon Champions —{" "}
            <span className="text-primary">Regulation M-A Roster</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.totalCount} Pokemon confirmed available ·{" "}
            {data.megaEvolutions.length} Mega Evolutions ·{" "}
            {data.items.confirmed.length} confirmed items
          </p>
        </div>

        {/* Format rules */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-[10px]">
            {data.rules.totalPoints} stat points
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            Max {data.rules.perStatMax} per stat
          </Badge>
          <Badge
            variant={data.rules.terastallization ? "success" : "error"}
            className="text-[10px]"
          >
            {data.rules.terastallization ? "Tera ON" : "No Terastallization"}
          </Badge>
          <Badge
            variant={data.rules.megaEvolution ? "success" : "error"}
            className="text-[10px]"
          >
            {data.rules.megaEvolution ? "Mega Evolution" : "No Mega"}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {data.rules.format}
          </Badge>
          <Badge variant="info" className="text-[10px]">
            {data.rules.period}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
        <TabsList>
          <TabsTrigger value="pokemon">Pokemon</TabsTrigger>
          <TabsTrigger value="megas">Mega Evolutions</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* Pokemon tab                                                       */}
        {/* ================================================================ */}
        <TabsContent value="pokemon" className="flex flex-col gap-4 pt-2">
          {/* Filters */}
          <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-card/50 p-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Pokemon by name..."
              autoComplete="off"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">
                Types:
              </span>
              {ALL_TYPES.map((t) => (
                <TypeBadge
                  key={t}
                  type={t}
                  active={selectedTypes.has(t)}
                  onClick={() => toggleType(t)}
                />
              ))}
              {selectedTypes.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTypes(new Set())}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={megaOnly}
                  onChange={(e) => setMegaOnly(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary cursor-pointer"
                />
                Can Mega Evolve only
              </label>
              <span className="text-[10px] text-muted-foreground">
                {filteredPokemon.length} of {data.totalCount} shown
              </span>
            </div>
          </div>

          {/* Grid */}
          {filteredPokemon.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredPokemon.map((p) => (
                <PokemonCard key={p.species} pokemon={p} />
              ))}
            </div>
          ) : (
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No Pokemon match the current filters.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* Mega Evolutions tab                                               */}
        {/* ================================================================ */}
        <TabsContent value="megas" className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-foreground">
              Available Mega Evolutions
            </h2>
            <p className="text-xs text-muted-foreground">
              {data.megaEvolutions.length} Mega forms playable in Champions —
              both returning Gen 6/7 Megas and new Legends Z-A introductions.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {data.megaEvolutions.map((m) => {
              const baseName = m.species.split("-")[0];
              return (
                <MegaCard
                  key={m.species}
                  species={m.species}
                  stone={m.stone}
                  baseAbilities={baseAbilitiesByName.get(baseName)}
                />
              );
            })}
          </div>

          {/* No-mega-despite-base callout */}
          {data.noMegaDespiteBase.length > 0 && (
            <Card className="bg-red-500/5 border-red-500/30">
              <CardContent className="px-4 py-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-red-400">
                    Cannot Mega Evolve
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  These Pokemon are in Champions, but their Mega Stones are
                  NOT available. Do not build them expecting Mega access.
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.noMegaDespiteBase.map((n) => (
                    <div
                      key={n}
                      className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1"
                    >
                      <PokemonSprite species={n} size={24} />
                      <span className="text-[11px] font-medium text-red-200">
                        {n}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* Items tab                                                         */}
        {/* ================================================================ */}
        <TabsContent value="items" className="flex flex-col gap-4 pt-2">
          {/* Confirmed items */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                Confirmed Items
              </h2>
              <Badge variant="success" className="text-[10px]">
                Verified
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {data.items.confirmed.length} items confirmed on cartridge via
              competitive usage data.
            </p>

            {/* Split: non-mega-stones first, mega stones second */}
            {(() => {
              const stones = data.items.confirmed.filter((i) =>
                MEGA_STONE_SET.has(i),
              );
              const others = data.items.confirmed.filter(
                (i) => !MEGA_STONE_SET.has(i),
              );

              return (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                      Held Items ({others.length})
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {others.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center rounded-md border border-green-500/30 bg-green-500/10 px-2 py-1 text-[11px] font-medium text-green-200"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  {stones.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-xs uppercase tracking-wider text-amber-400">
                        Mega Stones ({stones.length})
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {stones.map((item) => (
                          <span
                            key={item}
                            className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-200"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Uncertain items */}
          {data.items.uncertain.length > 0 && (
            <Card className="bg-amber-500/5 border-amber-500/30">
              <CardContent className="px-4 py-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
                    Uncertain Items
                  </h2>
                  <Badge variant="warning" className="text-[9px]">
                    Verify before use
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  These items appear in Showdown Champions Preview data but
                  may not be available on cartridge. Use with caution.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.items.uncertain.map((item) => (
                    <span
                      key={item}
                      title="Appears in Showdown data but may not be on cartridge"
                      className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-200 cursor-help"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
