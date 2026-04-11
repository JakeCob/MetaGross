import type { TeamPokemon } from "@/lib/types/pokemon";
import type { FieldState, Side } from "@/lib/types/battle";
import { DEFAULT_FIELD_STATE } from "@/lib/types/battle";
import { calcStat } from "@/lib/pokemon/stats";
import { getSpecies } from "@/lib/pokemon/species";

/**
 * Calculate the effective speed of a Pokemon accounting for
 * nature, EVs, IVs, items, status, abilities, and field conditions.
 */
export function getEffectiveSpeed(
  pokemon: TeamPokemon,
  field: FieldState = DEFAULT_FIELD_STATE,
  status: string | null = null,
  side: Side = "p1",
): number {
  const speciesData = getSpecies(pokemon.species);
  if (!speciesData) return 0;

  // Calculate base speed stat
  let speed = calcStat(
    "spe",
    speciesData.baseStats.spe,
    pokemon.ivs.spe,
    pokemon.evs.spe,
    pokemon.level,
    pokemon.nature,
  );

  // Item modifiers
  if (pokemon.item === "Choice Scarf") {
    speed = Math.floor(speed * 1.5);
  } else if (pokemon.item === "Iron Ball") {
    speed = Math.floor(speed / 2);
  }

  // Status modifiers
  if (status === "paralysis") {
    speed = Math.floor(speed / 2);
  }

  // Ability modifiers (common speed abilities)
  if (
    pokemon.ability === "Swift Swim" &&
    field.weather === "rain"
  ) {
    speed = Math.floor(speed * 2);
  } else if (
    pokemon.ability === "Chlorophyll" &&
    field.weather === "sun"
  ) {
    speed = Math.floor(speed * 2);
  } else if (
    pokemon.ability === "Sand Rush" &&
    field.weather === "sand"
  ) {
    speed = Math.floor(speed * 2);
  } else if (
    pokemon.ability === "Slush Rush" &&
    field.weather === "snow"
  ) {
    speed = Math.floor(speed * 2);
  } else if (pokemon.ability === "Unburden" && !pokemon.item) {
    speed = Math.floor(speed * 2);
  }

  // Tailwind (doubles speed)
  const hasTailwind =
    (side === "p1" && field.tailwindP1) ||
    (side === "p2" && field.tailwindP2);
  if (hasTailwind) {
    speed = speed * 2;
  }

  return speed;
}

/**
 * Compare two Pokemon speeds. Returns 'a' if a is faster, 'b' if b is faster, 'tie' if equal.
 * In Trick Room, the slower Pokemon moves first.
 */
export function compareSpeed(
  a: TeamPokemon,
  b: TeamPokemon,
  field: FieldState = DEFAULT_FIELD_STATE,
  aSide: Side = "p1",
  bSide: Side = "p2",
  aStatus: string | null = null,
  bStatus: string | null = null,
): "a" | "b" | "tie" {
  const speedA = getEffectiveSpeed(a, field, aStatus, aSide);
  const speedB = getEffectiveSpeed(b, field, bStatus, bSide);

  if (speedA === speedB) return "tie";

  if (field.trickRoom) {
    // In Trick Room, slower moves first
    return speedA < speedB ? "a" : "b";
  }

  return speedA > speedB ? "a" : "b";
}

/**
 * Get a sorted speed tier list for a set of Pokemon.
 */
export function getSpeedTiers(
  pokemon: TeamPokemon[],
  field: FieldState = DEFAULT_FIELD_STATE,
  sides?: Side[],
): { pokemon: TeamPokemon; speed: number; side?: Side }[] {
  const tiers = pokemon.map((p, i) => ({
    pokemon: p,
    speed: getEffectiveSpeed(p, field, null, sides?.[i] ?? "p1"),
    side: sides?.[i],
  }));

  // Sort by speed descending (or ascending in Trick Room)
  tiers.sort((a, b) =>
    field.trickRoom ? a.speed - b.speed : b.speed - a.speed,
  );

  return tiers;
}
