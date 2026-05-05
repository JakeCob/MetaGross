import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TeamBuilderWithAgent } from "@/components/team-builder/TeamBuilderWithAgent";
import { getTeamById } from "@/lib/db/queries/teams";
import { getSpecies } from "@/lib/pokemon/species";
import { calcStat } from "@/lib/pokemon/stats";
import { PokemonSprite } from "@/components/pokemon-sprite";
import { getMegaFormFor } from "@/lib/data/champions";

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

const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
const STAT_LABELS: Record<string, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return (value as T) ?? fallback;
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (id === "new") {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:py-8">
        <TeamBuilderWithAgent />
      </div>
    );
  }

  const team = getTeamById(id);

  if (!team) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{team.name}</h1>
            {team.format && (
              <Badge variant="info">{team.format}</Badge>
            )}
            {team.isActive === 1 && (
              <Badge variant="success">Active</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            {team.pokemon.length} Pokemon &middot; Created{" "}
            {team.createdAt
              ? new Date(team.createdAt).toLocaleDateString()
              : "unknown"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/teams" className="flex-1 sm:flex-none">
            <Button variant="outline" className="w-full sm:w-auto">Back to Teams</Button>
          </Link>
          <Link href={`/teams/${id}/edit`} className="flex-1 sm:flex-none">
            <Button className="w-full sm:w-auto">Edit Team</Button>
          </Link>
        </div>
      </div>

      {team.pokemon.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <h2 className="text-xl font-semibold">No Pokemon</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This team has no Pokemon yet.
              </p>
              <Link href={`/teams/${id}/edit`} className="mt-4">
                <Button>Add Pokemon</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {team.pokemon.map((mon, i) => {
            const speciesData = getSpecies(mon.species);
            const moves = parseJsonField<string[]>(mon.moves, []);
            const evs = parseJsonField<Record<string, number>>(mon.evs, {
              hp: 0,
              atk: 0,
              def: 0,
              spa: 0,
              spd: 0,
              spe: 0,
            });
            const ivs = parseJsonField<Record<string, number>>(mon.ivs, {
              hp: 31,
              atk: 31,
              def: 31,
              spa: 31,
              spd: 31,
              spe: 31,
            });
            const level = mon.level ?? 50;
            const nature = mon.nature ?? "Hardy";
            const megaForm = getMegaFormFor(mon.species, mon.item);
            const spriteSpecies = megaForm ?? mon.species;
            const isMega = Boolean(megaForm);
            const displayName = isMega ? `Mega ${mon.species}` : mon.species;
            // When holding a Mega Stone, show the Mega form's types.
            const megaSpeciesData = isMega && megaForm ? getSpecies(megaForm) : null;
            const displayTypes = megaSpeciesData?.types ?? speciesData?.types ?? [];

            return (
              <Card key={mon.id ?? i}>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      <PokemonSprite
                        species={spriteSpecies}
                        mega={isMega}
                        size={72}
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base truncate">
                          {displayName}
                        </CardTitle>
                        {isMega && (
                          <Badge
                            variant="warning"
                            className="text-[9px] px-1.5 uppercase tracking-wider shrink-0"
                          >
                            Mega
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {displayTypes.map((type) => (
                          <Badge
                            key={type}
                            className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[type] ?? "bg-gray-600 text-white"}`}
                          >
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    {/* Info row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {mon.ability && (
                        <span>
                          <span className="text-foreground">{mon.ability}</span>
                        </span>
                      )}
                      {mon.item && (
                        <span>
                          <span className="text-foreground">{mon.item}</span>
                        </span>
                      )}
                      <span>
                        {nature} &middot; Lv.{level}
                      </span>
                    </div>

                    {/* Moves */}
                    <div className="flex flex-wrap gap-1">
                      {moves.filter(Boolean).map((move, j) => (
                        <span
                          key={j}
                          className="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-foreground"
                        >
                          {move}
                        </span>
                      ))}
                    </div>

                    {/* Stats */}
                    {speciesData && (
                      <div className="grid grid-cols-6 gap-1">
                        {STAT_KEYS.map((key) => {
                          const base = speciesData.baseStats[key];
                          const ev = evs[key] ?? 0;
                          const iv = ivs[key] ?? 31;
                          const final = calcStat(key, base, iv, ev, level, nature);
                          return (
                            <div
                              key={key}
                              className="flex flex-col items-center rounded border border-border bg-background px-1 py-1"
                            >
                              <span className="text-[9px] text-muted-foreground">
                                {STAT_LABELS[key]}
                              </span>
                              <span className="text-xs font-mono font-medium text-primary">
                                {final}
                              </span>
                              <span className="text-[9px] font-mono text-muted-foreground">
                                {ev > 0 ? `${ev}` : "-"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
