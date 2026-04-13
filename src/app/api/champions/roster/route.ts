/**
 * Champions roster API.
 *
 * Returns the full Pokemon Champions Regulation M-A roster, enriched with
 * species data (types, base stats, abilities) from @pkmn/data, plus lists
 * of confirmed/uncertain items, available Mega Evolutions, and format rules.
 */
import {
  CHAMPIONS_POKEMON,
  CHAMPIONS_ITEMS_CONFIRMED,
  CHAMPIONS_ITEMS_UNCERTAIN,
  CHAMPIONS_MEGAS,
  NO_MEGA_DESPITE_BASE,
  NOT_IN_CHAMPIONS,
  CHAMPIONS_RULES,
  CHAMPIONS_POINTS,
} from "@/lib/data/champions";
import { getSpecies } from "@/lib/pokemon/species";

export const revalidate = 3600; // 1 hour

export interface RosterPokemon {
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

export interface RosterResponse {
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

export async function GET() {
  try {
    const pokemon: RosterPokemon[] = [];

    for (const name of CHAMPIONS_POKEMON) {
      const data = getSpecies(name);
      if (!data) continue;

      // A base species "canMegaEvolve" if any Mega key starts with its name
      // AND it is not on the NO_MEGA_DESPITE_BASE list.
      const megaEntry = Object.entries(CHAMPIONS_MEGAS).find(([key]) => {
        if (key === name) return true;
        // e.g. "Charizard-Mega-X" → base "Charizard"
        return key.startsWith(`${name}-Mega`);
      });

      const blocked = NO_MEGA_DESPITE_BASE.some(
        (n) => n.toLowerCase() === name.toLowerCase(),
      );

      pokemon.push({
        species: data.name,
        types: data.types,
        baseStats: data.baseStats,
        canMegaEvolve: Boolean(megaEntry) && !blocked,
        megaStone: megaEntry && !blocked ? megaEntry[1].stone : null,
        abilities: data.abilities,
      });
    }

    const megaEvolutions = Object.entries(CHAMPIONS_MEGAS).map(
      ([species, info]) => ({ species, stone: info.stone }),
    );

    const body: RosterResponse = {
      totalCount: pokemon.length,
      pokemon,
      items: {
        confirmed: CHAMPIONS_ITEMS_CONFIRMED,
        uncertain: CHAMPIONS_ITEMS_UNCERTAIN,
      },
      megaEvolutions,
      noMegaDespiteBase: NO_MEGA_DESPITE_BASE,
      notInChampions: NOT_IN_CHAMPIONS,
      rules: {
        totalPoints: CHAMPIONS_POINTS.totalMax,
        perStatMax: CHAMPIONS_POINTS.perStatMax,
        period: CHAMPIONS_RULES.period,
        terastallization: CHAMPIONS_RULES.terastallization,
        megaEvolution: CHAMPIONS_RULES.megaEvolution,
        format: CHAMPIONS_RULES.format,
        teamSize: CHAMPIONS_RULES.teamSize,
        bring: CHAMPIONS_RULES.bring,
        level: CHAMPIONS_RULES.level,
      },
    };

    return Response.json(body);
  } catch (error) {
    console.error("GET /api/champions/roster error:", error);
    return Response.json(
      { error: "Failed to load Champions roster" },
      { status: 500 },
    );
  }
}
