/**
 * Type effectiveness and type list utilities.
 *
 * Uses @pkmn/data's Types.totalEffectiveness which computes the
 * combined multiplier of an attack type against one or more defense types.
 */
import type { TypeName } from "@pkmn/dex-types";
import { defaultGen } from "./generations";

/**
 * Calculate the damage multiplier for an attack type against one or more defense types.
 * Returns 0, 0.25, 0.5, 1, 2, or 4.
 */
export function getTypeEffectiveness(
  attackType: string,
  defenseTypes: string[],
): number {
  if (defenseTypes.length === 0) return 1;

  return defaultGen.types.totalEffectiveness(
    attackType as TypeName,
    defenseTypes as TypeName[],
  );
}

/**
 * Get all type names in the current generation.
 */
export function getAllTypes(): string[] {
  const names: string[] = [];
  for (const type of defaultGen.types) {
    names.push(type.name);
  }
  return names;
}
