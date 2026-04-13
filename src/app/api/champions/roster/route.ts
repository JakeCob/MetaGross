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

// Don't cache — the roster is source-of-truth and edits should appear
// immediately. Cost is trivial (pure in-memory data assembly).
export const revalidate = 0;
export const dynamic = "force-dynamic";

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
  /** Mega form details (present when canMegaEvolve is true). */
  megaForms?: Array<{
    species: string; // e.g., "Charizard-Mega-X"
    types: string[];
    baseStats: {
      hp: number;
      atk: number;
      def: number;
      spa: number;
      spd: number;
      spe: number;
    };
    abilities: string[];
    stone: string;
  }>;
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

      // Find every Mega key belonging to this base (covers X/Y forms).
      const megaEntries = Object.entries(CHAMPIONS_MEGAS).filter(([key]) => {
        if (key === name) return true;
        return key.startsWith(`${name}-Mega`);
      });

      const blocked = NO_MEGA_DESPITE_BASE.some(
        (n) => n.toLowerCase() === name.toLowerCase(),
      );

      const canMegaEvolve = megaEntries.length > 0 && !blocked;

      const megaForms = canMegaEvolve
        ? megaEntries.flatMap(([megaSpecies, info]) => {
            const mData = getSpecies(megaSpecies);
            if (!mData) return [];
            return [
              {
                species: mData.name,
                types: mData.types,
                baseStats: mData.baseStats,
                abilities: mData.abilities,
                stone: info.stone,
              },
            ];
          })
        : undefined;

      pokemon.push({
        species: data.name,
        types: data.types,
        baseStats: data.baseStats,
        canMegaEvolve,
        megaStone: canMegaEvolve ? megaEntries[0][1].stone : null,
        abilities: data.abilities,
        megaForms,
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
