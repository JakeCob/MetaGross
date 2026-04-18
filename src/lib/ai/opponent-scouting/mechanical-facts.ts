/**
 * Mechanical Facts — precomputed VGC truths for the synthesizer.
 *
 * The synthesizer is an LLM; asking it to remember every Mega ability
 * swap, every Fake Out immunity, every 4× weakness from pretraining is
 * unreliable (Gemini hallucinated "Snow Warning" on Mega Froslass once
 * and misread Basculegion's Ghost typing elsewhere). This module shifts
 * those facts from the model to code.
 *
 * We cite @pkmn/dex as the data source. For custom Pokemon Champions
 * Megas, dex data may not match the Champions ruleset — each Mega entry
 * therefore carries a `source: "pkmn-dex" | "unknown"` tag so the LLM
 * can flag uncertainty to the user.
 *
 * SERVER-ONLY — imports @pkmn/dex and @pkmn/data via ./src/lib/pokemon.
 */

import { getSpecies } from "@/lib/pokemon/species";
import { getTypeEffectiveness } from "@/lib/pokemon/types";
import { getMegaFormFor } from "@/lib/data/champions";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { PredictedSet } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MegaAbilitySwap {
  side: "my" | "opp";
  baseSpecies: string;
  /** Mega form species (e.g. "Gyarados-Mega"). */
  megaSpecies: string;
  /** Stone held. */
  stone: string;
  /** Base-form ability (active before Mega Evolution). */
  baseAbility: string;
  /** Mega-form ability per @pkmn/dex. May differ from Champions ruleset. */
  megaAbility: string | null;
  source: "pkmn-dex" | "unknown";
  /** Short coach-facing implication, e.g. "Mega turn overrides Drizzle". */
  implication: string;
}

export interface FakeOutImmunity {
  side: "my" | "opp";
  species: string;
  /** "Ghost-type" | "Inner Focus" | "Queenly Majesty" | "Dazzling" | "Own Tempo". */
  reason: string;
}

export interface FourXWeakness {
  side: "opp" | "my";
  species: string;
  defenseTypes: string[];
  /** Attack types that do 4×. */
  weakTo: string[];
  /** Species on the OTHER side whose moves include one of these types (with
   *  the actual move names). Empty if nothing exploits it. */
  exploiters: Array<{ species: string; moves: string[]; types: string[] }>;
}

export interface WeatherSetter {
  side: "my" | "opp";
  species: string;
  ability: string;
  /** "rain" | "sun" | "sand" | "snow" */
  effect: "rain" | "sun" | "sand" | "snow";
  /** True if this triggers on switch-in (most weather-setter abilities do). */
  onEntry: boolean;
}

export interface IntimidateInteraction {
  /** Who has Intimidate. */
  intimidatorSide: "my" | "opp";
  intimidator: string;
  /** Who on the other side gets buffed if Intimidated. */
  baitSide: "my" | "opp";
  baitSpecies: string;
  baitAbility: "Defiant" | "Competitive" | "Contrary";
  outcome: string;
}

export interface MechanicalFacts {
  megaAbilitySwaps: MegaAbilitySwap[];
  fakeOutImmunities: FakeOutImmunity[];
  fourXWeaknesses: FourXWeakness[];
  weatherSetters: WeatherSetter[];
  intimidateInteractions: IntimidateInteraction[];
  /** Free-form facts — Levitate (Ground immunity), Cloud Nine/Air Lock
   *  (weather suppression), Mold Breaker (bypass), Magic Bounce, etc. */
  notableAbilities: Array<{ side: "my" | "opp"; species: string; ability: string; note: string }>;
}

// ---------------------------------------------------------------------------
// Static ability tables
// ---------------------------------------------------------------------------

const WEATHER_ABILITY: Record<string, "rain" | "sun" | "sand" | "snow"> = {
  Drizzle: "rain",
  Drought: "sun",
  "Sand Stream": "sand",
  "Snow Warning": "snow",
  "Orichalcum Pulse": "sun",
  "Hadron Engine": "sun", // grid-sun is Electric Terrain — kept as sun-analogue
};

const FAKE_OUT_IMMUNE_ABILITIES = new Set([
  "Inner Focus",
  "Queenly Majesty",
  "Dazzling",
  "Armor Tail",
  "Own Tempo", // immune to confusion, Fake Out flinch still applies but coaches treat it as "disrupt-resistant" — DROP from here actually
]);

// Actually Own Tempo blocks confusion, not flinch. Keep the set tight.
FAKE_OUT_IMMUNE_ABILITIES.delete("Own Tempo");

const INTIMIDATE_BAIT_ABILITIES = new Set(["Defiant", "Competitive", "Contrary"]);

const NOTABLE_ABILITY_NOTES: Record<string, string> = {
  Levitate: "Immune to Ground moves — Earthquake, EQ spread miss this.",
  "Cloud Nine": "Suppresses all weather effects while in play.",
  "Air Lock": "Suppresses all weather effects while in play.",
  "Mold Breaker": "Ignores ability-based immunities (Levitate, Sturdy, etc.).",
  Turboblaze: "Ignores ability-based immunities on contact.",
  Teravolt: "Ignores ability-based immunities on contact.",
  "Magic Bounce": "Reflects status moves — Taunt, Will-O-Wisp, etc.",
  "Magic Guard": "Takes no indirect damage — burn, sandstorm, Life Orb.",
  Unaware: "Ignores opponent's stat changes on attack/defense.",
  "Water Bubble": "Doubles own Water-move damage, halves incoming Fire, burn-immune.",
  "Rough Skin": "Chips attacker on contact — punishes Liquidation, Lunge.",
  "Iron Barbs": "Chips attacker on contact.",
  Prankster: "Grants +1 priority to status moves.",
  "Psychic Surge": "Sets Psychic Terrain — blocks priority vs grounded foes.",
  "Electric Surge": "Sets Electric Terrain — grounded foes can't sleep.",
  "Grassy Surge": "Sets Grassy Terrain — halves Earthquake, heals grounded.",
  "Misty Surge": "Sets Misty Terrain — blocks status on grounded foes.",
  "Parental Bond": "Attacks twice; second hit at 25%.",
  "Tough Claws": "+30% damage on contact moves.",
  Aerilate: "Normal moves become Flying-typed, +20% power.",
  Pixilate: "Normal moves become Fairy-typed, +20% power.",
  Refrigerate: "Normal moves become Ice-typed, +20% power.",
  Galvanize: "Normal moves become Electric-typed, +20% power.",
  "Normalize": "All moves become Normal, +20% power.",
  "Sheer Force": "Moves with secondary effects hit +30%, lose the effect.",
  Scrappy: "Normal/Fighting hit Ghost. Also flinch-immune.",
  "Huge Power": "Doubles Attack.",
  "Pure Power": "Doubles Attack.",
  "Swift Swim": "Doubled Speed in rain.",
  "Chlorophyll": "Doubled Speed in sun.",
  "Sand Rush": "Doubled Speed in sand.",
  "Slush Rush": "Doubled Speed in snow.",
  "Surge Surfer": "Doubled Speed on Electric Terrain.",
};

// ---------------------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------------------

/**
 * Compute mechanical facts from MY team + predicted opponent sets.
 * Safe to call every synthesizer run — cost is a handful of dex lookups.
 */
export function computeMechanicalFacts(
  myTeam: TeamPokemon[],
  opponentPredictions: PredictedSet[],
): MechanicalFacts {
  const mySide = myTeam.map((p) => ({
    species: p.species,
    ability: p.ability,
    item: p.item,
    moves: p.moves.filter(Boolean),
  }));
  const oppSide = opponentPredictions.map((p) => ({
    species: p.species,
    ability: p.ability,
    item: p.item,
    moves: p.moves.filter(Boolean),
  }));

  return {
    megaAbilitySwaps: computeMegaSwaps(mySide, oppSide),
    fakeOutImmunities: computeFakeOutImmunities(mySide, oppSide),
    fourXWeaknesses: computeFourXWeaknesses(mySide, oppSide),
    weatherSetters: computeWeatherSetters(mySide, oppSide),
    intimidateInteractions: computeIntimidateInteractions(mySide, oppSide),
    notableAbilities: computeNotableAbilities(mySide, oppSide),
  };
}

// ---------------------------------------------------------------------------
// Mega ability swaps
// ---------------------------------------------------------------------------

interface Entry {
  species: string;
  ability: string;
  item: string;
  moves: string[];
}

function computeMegaSwaps(my: Entry[], opp: Entry[]): MegaAbilitySwap[] {
  const out: MegaAbilitySwap[] = [];
  for (const side of ["my", "opp"] as const) {
    const list = side === "my" ? my : opp;
    for (const p of list) {
      const mega = getMegaFormFor(p.species, p.item);
      if (!mega) continue;
      const megaDex = getSpecies(mega);
      const megaAbility = megaDex?.abilities?.[0] ?? null;
      const source = megaDex ? "pkmn-dex" : "unknown";

      let implication = "";
      if (megaAbility && WEATHER_ABILITY[megaAbility]) {
        implication = `Mega triggers ${WEATHER_ABILITY[megaAbility]} — overrides other weather on the turn it Megas.`;
      } else if (megaAbility === "Intimidate") {
        implication = "Mega triggers Intimidate on the Mega turn.";
      } else if (megaAbility === "Parental Bond") {
        implication = "Doubles up hits — KO math changes once Mega'd.";
      } else if (megaAbility) {
        implication = `Mega ability: ${megaAbility}.`;
      } else {
        implication = "Mega ability not in dex — verify against Champions ruleset.";
      }

      out.push({
        side,
        baseSpecies: p.species,
        megaSpecies: mega,
        stone: p.item,
        baseAbility: p.ability,
        megaAbility,
        source,
        implication,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fake Out immunities
// ---------------------------------------------------------------------------

function computeFakeOutImmunities(my: Entry[], opp: Entry[]): FakeOutImmunity[] {
  const out: FakeOutImmunity[] = [];
  for (const side of ["my", "opp"] as const) {
    const list = side === "my" ? my : opp;
    for (const p of list) {
      const dex = getSpecies(p.species);
      if (!dex) continue;
      if (dex.types.includes("Ghost")) {
        out.push({ side, species: p.species, reason: "Ghost-type (Fake Out is Normal)" });
        continue;
      }
      if (FAKE_OUT_IMMUNE_ABILITIES.has(p.ability)) {
        out.push({ side, species: p.species, reason: `${p.ability} — flinch-immune` });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4× weaknesses
// ---------------------------------------------------------------------------

const ATTACK_TYPES = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison",
  "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark",
  "Steel", "Fairy",
];

function computeFourXWeaknesses(my: Entry[], opp: Entry[]): FourXWeakness[] {
  const out: FourXWeakness[] = [];
  // We surface opponents' 4× weaknesses (most important for picking leads)
  // AND mine (so the user knows what to avoid staying in against).
  for (const side of ["opp", "my"] as const) {
    const list = side === "opp" ? opp : my;
    const otherSide = side === "opp" ? my : opp;
    for (const p of list) {
      const dex = getSpecies(p.species);
      if (!dex || dex.types.length === 0) continue;
      const weakTo: string[] = [];
      for (const attackType of ATTACK_TYPES) {
        if (getTypeEffectiveness(attackType, dex.types) >= 4) {
          weakTo.push(attackType);
        }
      }
      if (weakTo.length === 0) continue;

      const exploiters: Array<{ species: string; moves: string[]; types: string[] }> = [];
      for (const attacker of otherSide) {
        if (attacker.moves.length === 0) continue;
        const matchedMoves: { move: string; type: string }[] = [];
        for (const move of attacker.moves) {
          const info = getMoveInfo(move);
          if (!info) continue;
          // Status moves don't exploit defensive weaknesses.
          if (info.category === "Status") continue;
          if (weakTo.includes(info.type)) {
            matchedMoves.push({ move, type: info.type });
          }
        }
        if (matchedMoves.length > 0) {
          exploiters.push({
            species: attacker.species,
            moves: matchedMoves.map((m) => m.move),
            types: [...new Set(matchedMoves.map((m) => m.type))],
          });
        }
      }

      out.push({
        side,
        species: p.species,
        defenseTypes: dex.types,
        weakTo,
        exploiters,
      });
    }
  }
  return out;
}

// Resolve a move name to its type + damage category via @pkmn/data.
// Status moves do not exploit type weaknesses even if the move is typed.
function getMoveInfo(moveName: string): { type: string; category: string } | null {
  try {
    // Inline require keeps this file tree-shakeable on the client even
    // though it's server-only by design.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@/lib/pokemon/moves") as typeof import("@/lib/pokemon/moves");
    const m = mod.getMove(moveName);
    return m ? { type: m.type, category: m.category } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Weather setters
// ---------------------------------------------------------------------------

function computeWeatherSetters(my: Entry[], opp: Entry[]): WeatherSetter[] {
  const out: WeatherSetter[] = [];
  for (const side of ["my", "opp"] as const) {
    const list = side === "my" ? my : opp;
    for (const p of list) {
      const effect = WEATHER_ABILITY[p.ability];
      if (!effect) continue;
      out.push({
        side,
        species: p.species,
        ability: p.ability,
        effect,
        onEntry: true,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Intimidate interactions
// ---------------------------------------------------------------------------

function computeIntimidateInteractions(
  my: Entry[],
  opp: Entry[],
): IntimidateInteraction[] {
  const out: IntimidateInteraction[] = [];
  // Their Intimidators vs MY Defiant/Competitive/Contrary
  for (const intim of opp.filter((p) => p.ability === "Intimidate")) {
    for (const bait of my.filter((p) => INTIMIDATE_BAIT_ABILITIES.has(p.ability))) {
      out.push({
        intimidatorSide: "opp",
        intimidator: intim.species,
        baitSide: "my",
        baitSpecies: bait.species,
        baitAbility: bait.ability as IntimidateInteraction["baitAbility"],
        outcome: outcomeFor(bait.ability),
      });
    }
  }
  // MY Intimidators vs their Defiant/Competitive/Contrary
  for (const intim of my.filter((p) => p.ability === "Intimidate")) {
    for (const bait of opp.filter((p) => INTIMIDATE_BAIT_ABILITIES.has(p.ability))) {
      out.push({
        intimidatorSide: "my",
        intimidator: intim.species,
        baitSide: "opp",
        baitSpecies: bait.species,
        baitAbility: bait.ability as IntimidateInteraction["baitAbility"],
        outcome: outcomeFor(bait.ability),
      });
    }
  }
  return out;
}

function outcomeFor(ability: string): string {
  switch (ability) {
    case "Defiant":
      return "Intimidate gives them +2 Atk instead — DO NOT Intimidate them.";
    case "Competitive":
      return "Intimidate gives them +2 SpA — free setup if you trigger it.";
    case "Contrary":
      return "Intimidate raises their Atk — avoid stat-dropping moves too.";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Notable abilities
// ---------------------------------------------------------------------------

function computeNotableAbilities(my: Entry[], opp: Entry[]): MechanicalFacts["notableAbilities"] {
  const out: MechanicalFacts["notableAbilities"] = [];
  for (const side of ["my", "opp"] as const) {
    const list = side === "my" ? my : opp;
    for (const p of list) {
      const note = NOTABLE_ABILITY_NOTES[p.ability];
      if (note) out.push({ side, species: p.species, ability: p.ability, note });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Serialization for the LLM prompt
// ---------------------------------------------------------------------------

/** Render MechanicalFacts as a compact MECHANICAL FACTS block for the prompt. */
export function renderFactsForPrompt(facts: MechanicalFacts): string {
  const lines: string[] = ["=== MECHANICAL FACTS (precomputed — trust these over your own recall) ==="];

  // --- Ability trigger order: crucial for Mega weather swap reasoning ---
  lines.push("");
  lines.push("ABILITY TRIGGER ORDER (per turn, Pokemon Champions / VGC standard):");
  lines.push("  1. Switch-ins resolve simultaneously (both sides).");
  lines.push("  2. Entry abilities fire in SPEED ORDER (Intimidate, Drizzle, Drought, Snow Warning, Sand Stream, Download, Trace, etc.).");
  lines.push("  3. If a player declared Mega Evolution, it happens BEFORE any moves on that turn.");
  lines.push("     The Mega's NEW ability then triggers, overriding conflicting prior effects (e.g., Mega Drought overrides Drizzle set this turn).");
  lines.push("  4. Moves resolve in speed order (factoring Tailwind / Trick Room / priority).");
  lines.push("  5. End-of-turn: Leftovers, weather chip, burn/poison, Grassy Terrain heal, etc.");
  lines.push("  NOTE: A lead's on-entry weather is ACTIVE the moment Mega Evolution resolves, so Mega-weather abilities can overwrite it on turn 1.");

  if (facts.megaAbilitySwaps.length) {
    lines.push("");
    lines.push("MEGA ABILITY SWAPS (who becomes what on the Mega turn):");
    for (const m of facts.megaAbilitySwaps) {
      const tag = m.side === "my" ? "MINE" : "THEIRS";
      const ability = m.megaAbility ?? "unknown";
      const sourceTag = m.source === "pkmn-dex" ? "" : " [Champions ruleset may differ]";
      lines.push(
        `  • [${tag}] ${m.baseSpecies} + ${m.stone} → ${m.megaSpecies} (ability: ${m.baseAbility} → ${ability})${sourceTag}. ${m.implication}`,
      );
    }
  }

  if (facts.weatherSetters.length) {
    lines.push("");
    lines.push("WEATHER SETTERS ON THE FIELD (entry abilities — active immediately on switch-in):");
    for (const w of facts.weatherSetters) {
      const tag = w.side === "my" ? "MINE" : "THEIRS";
      lines.push(`  • [${tag}] ${w.species} (${w.ability}) → ${w.effect}`);
    }
  }

  if (facts.fakeOutImmunities.length) {
    lines.push("");
    lines.push("FAKE OUT / FLINCH IMMUNITIES (do NOT target Fake Out here):");
    for (const f of facts.fakeOutImmunities) {
      const tag = f.side === "my" ? "MINE" : "THEIRS";
      lines.push(`  • [${tag}] ${f.species} — ${f.reason}`);
    }
  }

  if (facts.fourXWeaknesses.length) {
    const opp = facts.fourXWeaknesses.filter((w) => w.side === "opp");
    const mine = facts.fourXWeaknesses.filter((w) => w.side === "my");
    if (opp.length) {
      lines.push("");
      lines.push("OPPONENT 4× WEAKNESSES (and which of MY moves hit them for 4×):");
      for (const w of opp) {
        const ex = w.exploiters.length
          ? " → exploited by " +
            w.exploiters
              .map((e) => `${e.species} [${e.moves.join(", ")}]`)
              .join("; ")
          : " → NO EXPLOITER on my team";
        lines.push(
          `  • ${w.species} (${w.defenseTypes.join("/")}) is 4× weak to: ${w.weakTo.join(", ")}${ex}`,
        );
      }
    }
    if (mine.length) {
      lines.push("");
      lines.push("MY 4× WEAKNESSES (watch these stay out against threats):");
      for (const w of mine) {
        const ex = w.exploiters.length
          ? " ⚠ opponent has " +
            w.exploiters
              .map((e) => `${e.species} [${e.moves.join(", ")}]`)
              .join("; ")
          : "";
        lines.push(
          `  • ${w.species} (${w.defenseTypes.join("/")}) is 4× weak to: ${w.weakTo.join(", ")}${ex}`,
        );
      }
    }
  }

  if (facts.intimidateInteractions.length) {
    lines.push("");
    lines.push("INTIMIDATE × DEFIANT/COMPETITIVE/CONTRARY CHECK:");
    for (const i of facts.intimidateInteractions) {
      const intimTag = i.intimidatorSide === "my" ? "MY" : "THEIR";
      const baitTag = i.baitSide === "my" ? "MY" : "THEIR";
      lines.push(
        `  • ${intimTag} ${i.intimidator} Intimidates ${baitTag} ${i.baitSpecies} (${i.baitAbility}) — ${i.outcome}`,
      );
    }
  } else {
    // A "clean" flag is valuable too — tells the coach Intimidate is safe.
    lines.push("");
    lines.push("INTIMIDATE × DEFIANT/COMPETITIVE/CONTRARY CHECK: no conflicts — Intimidate is safe both directions.");
  }

  if (facts.notableAbilities.length) {
    lines.push("");
    lines.push("NOTABLE ABILITIES ON THE BOARD:");
    for (const n of facts.notableAbilities) {
      const tag = n.side === "my" ? "MINE" : "THEIRS";
      lines.push(`  • [${tag}] ${n.species} (${n.ability}): ${n.note}`);
    }
  }

  return lines.join("\n");
}
