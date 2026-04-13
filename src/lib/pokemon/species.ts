/**
 * Species lookup and search utilities.
 */
import { Dex } from "@pkmn/dex";
import { defaultGen } from "./generations";

export interface SpeciesData {
  name: string;
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
}

/**
 * Get species data by name. Returns null if not found.
 *
 * Falls back to the full `@pkmn/dex` dataset when the Gen 9 regional dex
 * doesn't include the species (many classics like Starmie, Alakazam,
 * Pinsir, etc. are absent from Scarlet/Violet but are present in Pokemon
 * Champions / Legends Z-A). The Dex fallback always has every species
 * introduced up to the current Gen.
 */
export function getSpecies(name: string): SpeciesData | null {
  // Narrow accepted shape so we can read from either @pkmn/data (Specie) or
  // @pkmn/dex (Species). Both expose name/types/baseStats/abilities.
  type SpeciesLike = {
    name: string;
    types: readonly string[];
    baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
    abilities: { 0?: string; 1?: string; H?: string; S?: string };
  } | null | undefined;

  const gen9 = defaultGen.species.get(name) as SpeciesLike;
  const species = gen9 ?? (Dex.species.get(name) as SpeciesLike);
  if (!species) return null;

  const abilities: string[] = [];
  const a = species.abilities;
  if (a["0"]) abilities.push(a["0"]);
  if (a["1"]) abilities.push(a["1"]);
  if (a["H"]) abilities.push(a["H"]);
  if (a["S"]) abilities.push(a["S"]);

  return {
    name: species.name,
    types: [...species.types],
    baseStats: { ...species.baseStats },
    abilities,
  };
}

/**
 * Search species by name prefix (case-insensitive).
 * Returns up to `limit` matching species (default 20).
 * An empty query returns an empty array.
 *
 * Searches the full @pkmn/dex catalog (not just Gen 9's regional dex) so
 * classics like Starmie/Alakazam that were cut from SV still show up.
 */
export function searchSpecies(
  query: string,
  limit: number = 20,
): SpeciesData[] {
  if (!query) return [];

  const lowerQuery = query.toLowerCase();
  const results: SpeciesData[] = [];
  const seen = new Set<string>();

  for (const species of Dex.species.all()) {
    if (results.length >= limit) break;
    if (species.name.toLowerCase().startsWith(lowerQuery)) {
      if (seen.has(species.name)) continue;
      seen.add(species.name);
      const data = getSpecies(species.name);
      if (data) results.push(data);
    }
  }

  return results;
}

/**
 * Get all species across the full @pkmn/dex dataset.
 */
export function getAllSpecies(): SpeciesData[] {
  const results: SpeciesData[] = [];
  const seen = new Set<string>();
  for (const species of Dex.species.all()) {
    if (seen.has(species.name)) continue;
    seen.add(species.name);
    const data = getSpecies(species.name);
    if (data) results.push(data);
  }
  return results;
}
