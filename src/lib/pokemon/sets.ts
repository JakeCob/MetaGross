/**
 * Import/export teams in pokepaste format using @pkmn/sets.
 */
import { Sets, Team } from "@pkmn/sets";
import type { Data } from "@pkmn/sets";
import { defaultGen } from "./generations";
import type { TeamPokemon, EVSpread, IVSpread } from "@/lib/types/pokemon";

const DEFAULT_EVS: EVSpread = {
  hp: 0,
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
};
const DEFAULT_IVS: IVSpread = {
  hp: 31,
  atk: 31,
  def: 31,
  spa: 31,
  spd: 31,
  spe: 31,
};

/**
 * Adapt @pkmn/data Generation to satisfy @pkmn/sets Data interface.
 * The Generation class has a `num` getter but @pkmn/sets expects a `gen` property.
 */
const setsData: Data = {
  get gen() {
    return defaultGen.num;
  },
  abilities: defaultGen.abilities,
  items: defaultGen.items,
  moves: defaultGen.moves,
  natures: defaultGen.natures,
  species: defaultGen.species,
};

/**
 * Parse a pokepaste-format string into an array of TeamPokemon.
 */
export function importTeamFromPaste(paste: string): TeamPokemon[] {
  const team = Team.import(paste, setsData);
  if (!team) return [];

  return team.team.map((set) => {
    const moves = (set.moves ?? []) as string[];
    // Pad to exactly 4 moves
    while (moves.length < 4) moves.push("");

    return {
      species: (set.species as string) ?? "",
      ability: (set.ability as string) ?? "",
      item: (set.item as string) ?? "",
      nature: (set.nature as string) ?? "Hardy",
      level: set.level ?? 100,
      teraType: set.teraType ?? undefined,
      moves: [moves[0], moves[1], moves[2], moves[3]] as [
        string,
        string,
        string,
        string,
      ],
      evs: set.evs ? { ...DEFAULT_EVS, ...set.evs } : { ...DEFAULT_EVS },
      ivs: set.ivs ? { ...DEFAULT_IVS, ...set.ivs } : { ...DEFAULT_IVS },
    };
  });
}

/**
 * Serialize an array of TeamPokemon to pokepaste format.
 */
export function exportTeamToPaste(team: TeamPokemon[]): string {
  const sets = team.map((mon) => ({
    species: mon.species,
    ability: mon.ability,
    item: mon.item,
    nature: mon.nature,
    level: mon.level,
    teraType: mon.teraType,
    moves: [...mon.moves],
    evs: { ...mon.evs },
    ivs: { ...mon.ivs },
  }));

  return sets.map((s) => Sets.exportSet(s, setsData)).join("\n");
}
