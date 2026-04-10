/**
 * Pokemon stat calculation using the Gen 3+ formula.
 */

type StatName = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

/**
 * Nature modifier map: nature name -> { plus?: StatName, minus?: StatName }.
 * Neutral natures (Hardy, Docile, Serious, Bashful, Quirky) have no modifiers.
 */
const NATURE_MODIFIERS: Record<
  string,
  { plus?: StatName; minus?: StatName }
> = {
  // Neutral natures
  Hardy: {},
  Docile: {},
  Serious: {},
  Bashful: {},
  Quirky: {},
  // +Atk
  Lonely: { plus: "atk", minus: "def" },
  Brave: { plus: "atk", minus: "spe" },
  Adamant: { plus: "atk", minus: "spa" },
  Naughty: { plus: "atk", minus: "spd" },
  // +Def
  Bold: { plus: "def", minus: "atk" },
  Relaxed: { plus: "def", minus: "spe" },
  Impish: { plus: "def", minus: "spa" },
  Lax: { plus: "def", minus: "spd" },
  // +SpA
  Modest: { plus: "spa", minus: "atk" },
  Mild: { plus: "spa", minus: "def" },
  Quiet: { plus: "spa", minus: "spe" },
  Rash: { plus: "spa", minus: "spd" },
  // +SpD
  Calm: { plus: "spd", minus: "atk" },
  Gentle: { plus: "spd", minus: "def" },
  Sassy: { plus: "spd", minus: "spe" },
  Careful: { plus: "spd", minus: "spa" },
  // +Spe
  Timid: { plus: "spe", minus: "atk" },
  Hasty: { plus: "spe", minus: "def" },
  Jolly: { plus: "spe", minus: "spa" },
  Naive: { plus: "spe", minus: "spd" },
};

/**
 * Get the nature modifier for a specific stat and nature.
 * Returns 1.1 for boosted stats, 0.9 for reduced stats, 1.0 for neutral.
 */
function getNatureModifier(stat: StatName, nature: string): number {
  const mod = NATURE_MODIFIERS[nature];
  if (!mod) return 1.0;
  if (mod.plus === stat) return 1.1;
  if (mod.minus === stat) return 0.9;
  return 1.0;
}

/**
 * Calculate a final stat value using the Gen 3+ formula.
 *
 * HP formula:
 *   floor((2 * base + iv + floor(ev/4)) * level / 100) + level + 10
 *
 * Other stats:
 *   floor((floor((2 * base + iv + floor(ev/4)) * level / 100) + 5) * natureModifier)
 *
 * @param stat - Stat name: 'hp', 'atk', 'def', 'spa', 'spd', 'spe'
 * @param base - Base stat value
 * @param iv - Individual value (0-31)
 * @param ev - Effort value (0-252)
 * @param level - Pokemon level (1-100)
 * @param nature - Nature name (e.g., 'Adamant', 'Jolly', 'Hardy')
 */
export function calcStat(
  stat: string,
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature: string,
): number {
  const core = Math.floor(
    ((2 * base + iv + Math.floor(ev / 4)) * level) / 100,
  );

  if (stat === "hp") {
    return core + level + 10;
  }

  const modifier = getNatureModifier(stat as StatName, nature);
  return Math.floor((core + 5) * modifier);
}
