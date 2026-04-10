/**
 * Ability lookup utilities.
 */
import { defaultGen } from "./generations";

export interface AbilityData {
  name: string;
  description: string;
}

/**
 * Get ability data by name. Returns null if not found.
 */
export function getAbility(name: string): AbilityData | null {
  const ability = defaultGen.abilities.get(name);
  if (!ability) return null;

  return {
    name: ability.name,
    description: ability.shortDesc || ability.desc,
  };
}

/**
 * Get all abilities a species can have.
 * Returns ability names from the species' ability slots (0, 1, H, S).
 */
export function getAbilitiesForSpecies(speciesName: string): AbilityData[] {
  const species = defaultGen.species.get(speciesName);
  if (!species) return [];

  const abilityNames: string[] = [];
  const abilitiesData = species.abilities;
  if (abilitiesData["0"]) abilityNames.push(abilitiesData["0"]);
  if (abilitiesData["1"]) abilityNames.push(abilitiesData["1"]);
  if (abilitiesData["H"]) abilityNames.push(abilitiesData["H"]);
  if (abilitiesData["S"]) abilityNames.push(abilitiesData["S"]);

  const results: AbilityData[] = [];
  for (const name of abilityNames) {
    const ability = getAbility(name);
    if (ability) results.push(ability);
  }

  return results;
}
