// Core Pokemon types used for team building and battle logging

export interface EVSpread {
  hp: number;   // 0-252
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface IVSpread {
  hp: number;   // 0-31
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface TeamPokemon {
  species: string;
  ability: string;
  item: string;
  nature: string;
  level: number;
  teraType?: string;          // SV formats
  megaEvolution?: string;     // Champions format (e.g., 'Metagross-Mega')
  moves: [string, string, string, string];
  evs: EVSpread;
  ivs: IVSpread;
}

// Helper type for the 6 stats
export type StatName = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';

// Nature modifiers: +10% to one stat, -10% to another
export interface NatureModifier {
  plus?: StatName;
  minus?: StatName;
}

// Pokemon species data from @pkmn/data
export interface SpeciesData {
  name: string;
  types: string[];
  baseStats: EVSpread;  // same shape, reuse
  abilities: string[];
  hiddenAbility?: string;
  weight: number;
  megaEvolutions?: string[];
}

// Default spreads
export const DEFAULT_EVS: EVSpread = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
export const DEFAULT_IVS: IVSpread = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
export const MAX_TOTAL_EVS = 510;
export const MAX_SINGLE_EV = 252;
