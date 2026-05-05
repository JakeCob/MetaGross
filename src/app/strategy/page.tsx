import { StrategyGenerator } from "@/components/strategy/StrategyGenerator";
import { db } from "@/lib/db";
import { teams, teamPokemon } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { TeamPokemon } from "@/lib/types/pokemon";

function getTeamsWithPokemon() {
  const allTeams = db.select().from(teams).all();

  return allTeams.map((team) => {
    const pokemon = db
      .select()
      .from(teamPokemon)
      .where(eq(teamPokemon.teamId, team.id))
      .all();

    return {
      id: team.id,
      name: team.name,
      pokemon: pokemon.map((p) => ({
        species: p.species,
        ability: p.ability,
        item: p.item ?? "",
        nature: p.nature ?? "Hardy",
        level: p.level ?? 50,
        megaEvolution: p.megaEvolution ?? undefined,
        teraType: p.teraType ?? undefined,
        moves: (p.moves as string[]) ?? ["", "", "", ""],
        evs: (p.evs as TeamPokemon["evs"]) ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        ivs: (p.ivs as TeamPokemon["ivs"]) ?? { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      })) as TeamPokemon[],
    };
  });
}

export default function StrategyPage() {
  const savedTeams = getTeamsWithPokemon();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Pre-Match Strategy</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Plan your game before it starts. Get lead and play-style recommendations powered by AI.
        </p>
      </div>

      <StrategyGenerator savedTeams={savedTeams} />
    </div>
  );
}
