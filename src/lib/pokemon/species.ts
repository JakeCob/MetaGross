/**
 * Species lookup and search utilities.
 */
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
 */
export function getSpecies(name: string): SpeciesData | null {
  const species = defaultGen.species.get(name);
  if (!species) return null;

  const abilities: string[] = [];
  const abilitiesData = species.abilities;
  if (abilitiesData["0"]) abilities.push(abilitiesData["0"]);
  if (abilitiesData["1"]) abilities.push(abilitiesData["1"]);
  if (abilitiesData["H"]) abilities.push(abilitiesData["H"]);
  if (abilitiesData["S"]) abilities.push(abilitiesData["S"]);

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
 */
export function searchSpecies(
  query: string,
  limit: number = 20,
): SpeciesData[] {
  if (!query) return [];

  const lowerQuery = query.toLowerCase();
  const results: SpeciesData[] = [];

  for (const species of defaultGen.species) {
    if (results.length >= limit) break;
    if (species.name.toLowerCase().startsWith(lowerQuery)) {
      const data = getSpecies(species.name);
      if (data) results.push(data);
    }
  }

  return results;
}

/**
 * Get all species in the current generation.
 */
export function getAllSpecies(): SpeciesData[] {
  const results: SpeciesData[] = [];
  for (const species of defaultGen.species) {
    const data = getSpecies(species.name);
    if (data) results.push(data);
  }
  return results;
}
