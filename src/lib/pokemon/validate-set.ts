/**
 * Validate an agent-proposed Pokemon build against @pkmn/dex.
 *
 * The agent can (and does) hallucinate — e.g. labelling a Garchomp
 * build as "Mega Scovillain", citing Rough Skin as Scovillain's
 * ability, etc. This module is a last-line defense that the UI can
 * call at render time to catch the lie.
 *
 * Server-only because it imports @pkmn/dex.
 */
import { getSpecies } from "./species";
import { getMove } from "./moves";

export interface ValidateSetInput {
  species: string;
  ability?: string;
  moves?: string[];
}

export interface SetWarning {
  /** One of: "species-missing", "ability-invalid", "move-invalid", "mega-name-ambiguous". */
  kind:
    | "species-missing"
    | "ability-invalid"
    | "move-invalid"
    | "mega-name-ambiguous";
  message: string;
  /** For ability/move warnings: what the dex says is valid. */
  expected?: string[];
}

export interface ValidateSetResult {
  /** Resolved species name per @pkmn/dex (e.g. "Scovillain-Mega"). Null when the species isn't found. */
  resolvedSpecies: string | null;
  /** Abilities the resolved species actually has. Empty if species missing. */
  speciesAbilities: string[];
  /** Warnings to surface to the user. Empty when the build checks out. */
  warnings: SetWarning[];
}

/**
 * Normalise a user-facing name to @pkmn/dex canonical forms.
 * Returns candidates in RESOLUTION-PREFERENCE ORDER — canonical form
 * first so getSpecies doesn't accidentally resolve "Mega Scovillain"
 * (which @pkmn/dex aliases back to base Scovillain) before we try
 * "Scovillain-Mega".
 *
 * Handles:
 *   "Mega Scovillain"  → ["Scovillain-Mega", "Mega Scovillain"]
 *   "Scovillain (Mega)" → ["Scovillain-Mega", ...]
 *   "Charizard-Mega-Y" → ["Charizard-Mega-Y"]  (already canonical)
 *   "Hisuian Zoroark"  → ["Zoroark-Hisui", ...]
 *   "Wash-Rotom"       → ["Rotom-Wash", ...]
 */
export function normalizeSpeciesName(raw: string): string[] {
  const cleaned = raw.trim();
  if (!cleaned) return [];

  // Ordered list so the best canonical form is tried first.
  const ordered: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    if (!seen.has(s)) {
      seen.add(s);
      ordered.push(s);
    }
  };

  // "Mega X" / "Mega X Y" → "X-Mega" / "X-Mega-Y"  (HIGHEST priority)
  const megaPrefix = cleaned.match(/^Mega\s+(.+)$/i);
  if (megaPrefix) {
    const rest = megaPrefix[1].trim();
    const words = rest.split(/\s+/);
    if (words.length === 1) {
      add(`${words[0]}-Mega`);
    } else {
      add(`${words[0]}-Mega-${words.slice(1).join("-")}`);
    }
  }

  // "X (Mega)" → "X-Mega"
  const parenMega = cleaned.match(/^(.+?)\s*\(Mega\)\s*$/i);
  if (parenMega) add(`${parenMega[1].trim()}-Mega`);

  // "Hisuian X" / "Alolan X" / "Galarian X" / "Paldean X" → "X-<Region>"
  const regional = cleaned.match(
    /^(Hisuian|Alolan|Galarian|Paldean)\s+(.+)$/i,
  );
  if (regional) {
    const tag = regional[1];
    const base = regional[2];
    const suffix =
      tag.toLowerCase() === "hisuian"
        ? "Hisui"
        : tag.toLowerCase() === "alolan"
          ? "Alola"
          : tag.toLowerCase() === "galarian"
            ? "Galar"
            : "Paldea";
    add(`${base}-${suffix}`);
  }

  // "Wash-Rotom" / "Heat-Rotom" → "Rotom-<Form>"
  const rotomDash = cleaned.match(/^(Wash|Heat|Frost|Fan|Mow)-Rotom$/i);
  if (rotomDash) add(`Rotom-${rotomDash[1]}`);

  // Fallbacks last.
  add(cleaned);
  const hyphenated = cleaned.replace(/\s+/g, "-");
  if (hyphenated !== cleaned) add(hyphenated);

  return ordered;
}

/**
 * Champions-specific Mega abilities that differ from @pkmn/dex's
 * defaults. Sourced from Jacob's in-game verification + Bulbapedia's
 * Z-A Mega roster. These are ADDITIVE — we accept the dex abilities
 * too, but ALSO accept any of these Champions-only Mega abilities as
 * valid without warning.
 */
const CHAMPIONS_MEGA_ABILITY_OVERRIDES: Record<string, string[]> = {
  "Scovillain-Mega": ["Spicy Spray"],
  "Delphox-Mega": ["Levitate"],
  "Froslass-Mega": ["Snow Warning"],
  "Starmie-Mega": ["Huge Power"],
  "Skarmory-Mega": ["Stalwart"],
  "Excadrill-Mega": ["Piercing Drill"],
  "Emboar-Mega": ["Mold Breaker"],
  "Chesnaught-Mega": ["Bulletproof"],
  "Chimecho-Mega": ["Levitate"],
  "Victreebel-Mega": ["Innards Out"],
};

/**
 * Validate a proposed build. Returns the resolved species + list of
 * warnings — empty warnings means the build looks clean.
 */
export function validateSet(input: ValidateSetInput): ValidateSetResult {
  const candidates = normalizeSpeciesName(input.species);
  let resolved: ReturnType<typeof getSpecies> = null;
  let resolvedName: string | null = null;
  for (const cand of candidates) {
    const found = getSpecies(cand);
    if (found) {
      resolved = found;
      resolvedName = cand;
      break;
    }
  }

  const warnings: SetWarning[] = [];

  if (!resolved) {
    return {
      resolvedSpecies: null,
      speciesAbilities: [],
      warnings: [
        {
          kind: "species-missing",
          message: `Species "${input.species}" not found in @pkmn/dex. Check the name.`,
        },
      ],
    };
  }

  const dexAbilities = resolved.abilities ?? [];
  const championsOverrides =
    (resolvedName && CHAMPIONS_MEGA_ABILITY_OVERRIDES[resolvedName]) ?? [];
  const allValidAbilities = [...dexAbilities, ...championsOverrides];

  // Ability check — case-insensitive.
  if (input.ability && allValidAbilities.length > 0) {
    const abilityLower = input.ability.trim().toLowerCase();
    const match = allValidAbilities.find(
      (a) => a.toLowerCase() === abilityLower,
    );
    if (!match) {
      warnings.push({
        kind: "ability-invalid",
        message: `"${input.ability}" is not an ability of ${resolvedName}. Valid: ${allValidAbilities.join(", ")}.`,
        expected: allValidAbilities,
      });
    }
  }

  // Move existence check — flag each move that @pkmn/dex doesn't know.
  // (We don't check the learnset here; that's heavier. We just catch
  // completely made-up move names like "Dragon Pulse Deluxe".)
  //
  // getMove doesn't check `exists` on the @pkmn/dex result, so we
  // cross-check here by requiring a non-empty move type — fake names
  // return a placeholder move record with type "".
  if (input.moves && input.moves.length > 0) {
    const bad: string[] = [];
    for (const move of input.moves) {
      if (!move.trim()) continue;
      const m = getMove(move);
      if (!m || !m.type) bad.push(move);
    }
    if (bad.length > 0) {
      warnings.push({
        kind: "move-invalid",
        message: `Unknown move${bad.length > 1 ? "s" : ""}: ${bad.join(", ")}.`,
      });
    }
  }

  return {
    resolvedSpecies: resolvedName,
    speciesAbilities: allValidAbilities,
    warnings,
  };
}
