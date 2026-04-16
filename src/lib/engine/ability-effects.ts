/**
 * Battle-mechanics effects triggered by abilities.
 *
 * This module captures the subset of ability behaviour that the battle
 * logger needs to:
 *   (a) auto-set weather / terrain when a Pokemon switches in, and
 *   (b) auto-negate moves / effects in the damage preview (Levitate,
 *       Armor Tail, Cloud Nine, etc.).
 *
 * The @smogon/calc library already accounts for most of this during
 * damage calc — this file exists so the UI layer can decide to show
 * "IMMUNE" tags, skip previews, or auto-update field state without
 * round-tripping through the full calc.
 */
import type { FieldState } from "@/lib/types/battle";

// ---------------------------------------------------------------------------
// Switch-in weather / terrain setters
// ---------------------------------------------------------------------------

export interface SwitchInEffect {
  weather?: FieldState["weather"];
  terrain?: FieldState["terrain"];
  /**
   * Legendary weather (Primordial Sea / Desolate Land / Delta Stream) —
   * not cleared by normal weather. We don't model the persistence in
   * state today, but flag it so the UI can warn.
   */
  isLegendary?: boolean;
}

const SWITCH_IN_EFFECTS: Record<string, SwitchInEffect> = {
  // Vanilla weather setters
  Drizzle:      { weather: "rain" },
  Drought:      { weather: "sun" },
  "Sand Stream": { weather: "sand" },
  "Snow Warning": { weather: "snow" },
  // Hadron Engine / Orichalcum Pulse set weather + terrain
  "Orichalcum Pulse": { weather: "sun" },
  "Hadron Engine":    { terrain: "electric" },
  // Legendary weather
  "Primordial Sea":   { weather: "rain", isLegendary: true },
  "Desolate Land":    { weather: "sun",  isLegendary: true },
  // Terrain setters
  "Electric Surge": { terrain: "electric" },
  "Grassy Surge":   { terrain: "grassy" },
  "Misty Surge":    { terrain: "misty" },
  "Psychic Surge":  { terrain: "psychic" },
};

/**
 * Get the switch-in effect for an ability, if any. Returns null when
 * the ability doesn't affect field state on entry.
 */
export function getSwitchInEffect(ability: string | null | undefined): SwitchInEffect | null {
  if (!ability) return null;
  return SWITCH_IN_EFFECTS[ability] ?? null;
}

// ---------------------------------------------------------------------------
// Passive / reactive effects
// ---------------------------------------------------------------------------

/** Abilities that negate weather effects for everyone on the field. */
const WEATHER_NEGATING = new Set<string>(["Cloud Nine", "Air Lock"]);

/** Abilities on the defender that block priority moves. */
const PRIORITY_BLOCKING = new Set<string>([
  "Armor Tail",
  "Dazzling",
  "Queenly Majesty",
]);

/** Abilities that grant immunity to a specific move type. */
const TYPE_IMMUNITY: Record<string, string[]> = {
  Levitate:        ["Ground"],
  "Flash Fire":    ["Fire"],
  "Water Absorb":  ["Water"],
  "Dry Skin":      ["Water"],
  "Storm Drain":   ["Water"],
  "Volt Absorb":   ["Electric"],
  "Lightning Rod": ["Electric"],
  "Motor Drive":   ["Electric"],
  "Sap Sipper":    ["Grass"],
  "Earth Eater":   ["Ground"],
};

/** Abilities that ignore opponent abilities (for accuracy). */
const ABILITY_IGNORING = new Set<string>([
  "Mold Breaker",
  "Teravolt",
  "Turboblaze",
  "Neutralizing Gas",
  "Mycelium Might",
]);

export function weatherIsNegated(
  attackerAbility: string | null | undefined,
  defenderAbility: string | null | undefined,
): boolean {
  return (
    (!!attackerAbility && WEATHER_NEGATING.has(attackerAbility)) ||
    (!!defenderAbility && WEATHER_NEGATING.has(defenderAbility))
  );
}

export function blocksPriorityMove(
  defenderAbility: string | null | undefined,
  movePriority: number,
): boolean {
  if (!defenderAbility || movePriority <= 0) return false;
  return PRIORITY_BLOCKING.has(defenderAbility);
}

/**
 * Does the defender's ability grant full immunity to the move's type?
 * Returns null if no immunity applies.
 */
export function typeImmunityReason(
  defenderAbility: string | null | undefined,
  moveType: string,
): string | null {
  if (!defenderAbility) return null;
  const blockedTypes = TYPE_IMMUNITY[defenderAbility];
  if (!blockedTypes) return null;
  if (blockedTypes.includes(moveType)) return defenderAbility;
  return null;
}

export function ignoresOpponentAbility(
  attackerAbility: string | null | undefined,
): boolean {
  return !!attackerAbility && ABILITY_IGNORING.has(attackerAbility);
}
