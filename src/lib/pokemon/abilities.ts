/**
 * Ability lookup utilities.
 */
import { Dex } from "@pkmn/dex";
import { defaultGen } from "./generations";

export interface AbilityData {
  name: string;
  description: string;
}

// Narrow shape compatible with both @pkmn/data (Ability) and @pkmn/dex (Ability).
type AbilityLike =
  | { name: string; shortDesc?: string; desc?: string }
  | null
  | undefined;

/**
 * Get ability data by name. Returns null if not found. Falls back from the
 * Gen 9 regional dex to the full @pkmn/dex catalog so abilities tied to
 * Pokemon cut from Scarlet/Violet still resolve.
 */
export function getAbility(name: string): AbilityData | null {
  const a =
    ((defaultGen.abilities.get(name) as AbilityLike) ??
      (Dex.abilities.get(name) as AbilityLike));
  if (!a) return null;

  return {
    name: a.name,
    description: a.shortDesc || a.desc || "",
  };
}

/**
 * Get all abilities a species can have.
 * Returns ability names from the species' ability slots (0, 1, H, S).
 *
 * Falls back to the full @pkmn/dex dataset when Gen 9 doesn't include the
 * species — same fix as getSpecies, since classics like Starmie, Alakazam,
 * Togekiss, etc. were cut from SV but are legal in Pokemon Champions.
 */
export function getAbilitiesForSpecies(speciesName: string): AbilityData[] {
  type SpeciesLike = {
    abilities: { 0?: string; 1?: string; H?: string; S?: string };
  } | null | undefined;

  const species =
    ((defaultGen.species.get(speciesName) as SpeciesLike) ??
      (Dex.species.get(speciesName) as SpeciesLike));
  if (!species) return [];

  const abilityNames: string[] = [];
  const slots = species.abilities;
  if (slots["0"]) abilityNames.push(slots["0"]);
  if (slots["1"]) abilityNames.push(slots["1"]);
  if (slots["H"]) abilityNames.push(slots["H"]);
  if (slots["S"]) abilityNames.push(slots["S"]);

  const results: AbilityData[] = [];
  for (const name of abilityNames) {
    const ability = getAbility(name);
    if (ability) results.push(ability);
  }

  return results;
}
