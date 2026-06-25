/**
 * Static Pokémon type-effectiveness chart (Gen 6+) and defensive matchup math.
 *
 * Pure data + functions — no `@pkmn` import, so this is safe to use on the
 * client. The chart is canonical and stable; we hardcode it to avoid a
 * server round-trip just to compute a 18×N defensive grid.
 */

export const POKEMON_TYPES = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice",
  "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug",
  "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
] as const;

export type PokemonType = (typeof POKEMON_TYPES)[number];

/**
 * TYPE_CHART[attacker][defender] = damage multiplier. Only non-neutral
 * entries are listed; a missing entry means ×1 (neutral).
 */
export const TYPE_CHART: Record<string, Record<string, number>> = {
  Normal: { Rock: 0.5, Steel: 0.5, Ghost: 0 },
  Fire: { Grass: 2, Ice: 2, Bug: 2, Steel: 2, Fire: 0.5, Water: 0.5, Rock: 0.5, Dragon: 0.5 },
  Water: { Fire: 2, Ground: 2, Rock: 2, Water: 0.5, Grass: 0.5, Dragon: 0.5 },
  Electric: { Water: 2, Flying: 2, Electric: 0.5, Grass: 0.5, Dragon: 0.5, Ground: 0 },
  Grass: { Water: 2, Ground: 2, Rock: 2, Fire: 0.5, Grass: 0.5, Poison: 0.5, Flying: 0.5, Bug: 0.5, Dragon: 0.5, Steel: 0.5 },
  Ice: { Grass: 2, Ground: 2, Flying: 2, Dragon: 2, Fire: 0.5, Water: 0.5, Ice: 0.5, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Rock: 2, Dark: 2, Steel: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Fairy: 0.5, Ghost: 0 },
  Poison: { Grass: 2, Fairy: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0 },
  Ground: { Fire: 2, Electric: 2, Poison: 2, Rock: 2, Steel: 2, Grass: 0.5, Bug: 0.5, Flying: 0 },
  Flying: { Grass: 2, Fighting: 2, Bug: 2, Electric: 0.5, Rock: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Steel: 0.5, Dark: 0 },
  Bug: { Grass: 2, Psychic: 2, Dark: 2, Fire: 0.5, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Ghost: 0.5, Steel: 0.5, Fairy: 0.5 },
  Rock: { Fire: 2, Ice: 2, Flying: 2, Bug: 2, Fighting: 0.5, Ground: 0.5, Steel: 0.5 },
  Ghost: { Psychic: 2, Ghost: 2, Dark: 0.5, Normal: 0 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Psychic: 2, Ghost: 2, Fighting: 0.5, Dark: 0.5, Fairy: 0.5 },
  Steel: { Ice: 2, Rock: 2, Fairy: 2, Fire: 0.5, Water: 0.5, Electric: 0.5, Steel: 0.5 },
  Fairy: { Fighting: 2, Dragon: 2, Dark: 2, Fire: 0.5, Poison: 0.5, Steel: 0.5 },
};

/**
 * Ability-based defensive modifiers: ABILITY_DEFENSE[ability][attackType] =
 * multiplier applied on top of the type chart. `0` = full immunity, `0.5` =
 * halved. Only the abilities that change a *type* matchup are listed (we skip
 * generic damage-reducers like Filter/Multiscale that don't flip a
 * weak/resist classification).
 */
export const ABILITY_DEFENSE: Record<string, Record<string, number>> = {
  Levitate: { Ground: 0 },
  "Flash Fire": { Fire: 0 },
  "Well-Baked Body": { Fire: 0 },
  "Water Absorb": { Water: 0 },
  "Dry Skin": { Water: 0 },
  "Storm Drain": { Water: 0 },
  "Volt Absorb": { Electric: 0 },
  "Lightning Rod": { Electric: 0 },
  "Motor Drive": { Electric: 0 },
  "Sap Sipper": { Grass: 0 },
  "Earth Eater": { Ground: 0 },
  "Thick Fat": { Fire: 0.5, Ice: 0.5 },
  Heatproof: { Fire: 0.5 },
  "Water Bubble": { Fire: 0.5 },
  "Purifying Salt": { Ghost: 0.5 },
};

/**
 * Defensive multiplier a Pokémon with `defenderTypes` (and optionally an
 * `ability`) takes from a move of `attackType`. Returns one of
 * 0 / 0.25 / 0.5 / 1 / 2 / 4.
 */
export function typeMatchup(
  attackType: string,
  defenderTypes: string[],
  ability?: string,
): number {
  const row = TYPE_CHART[attackType];
  let mult = 1;
  for (const d of defenderTypes) {
    mult *= row?.[d] ?? 1;
  }
  if (ability) {
    const mod = ABILITY_DEFENSE[ability]?.[attackType];
    if (mod !== undefined) mult *= mod;
  }
  return mult;
}

/** Human label for a multiplier (×4 / ×2 / ×1 / ×½ / ×¼ / immune). */
export function multiplierLabel(m: number): string {
  if (m === 0) return "immune";
  if (m === 0.25) return "×¼";
  if (m === 0.5) return "×½";
  if (m === 1) return "×1";
  if (m === 2) return "×2";
  if (m === 4) return "×4";
  return `×${m}`;
}
