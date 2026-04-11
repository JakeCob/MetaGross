import {
  calculate,
  Pokemon,
  Move,
  Field,
  type GenerationNum,
} from "@smogon/calc";
import type { TeamPokemon } from "@/lib/types/pokemon";

const GEN: GenerationNum = 9;

interface DamageCalcOptions {
  weather?: "rain" | "sun" | "sand" | "snow" | null;
  terrain?: "electric" | "grassy" | "misty" | "psychic" | null;
  isDoubles?: boolean;
  attackerSide?: {
    isReflect?: boolean;
    isLightScreen?: boolean;
    isAuroraVeil?: boolean;
    isTailwind?: boolean;
    isHelpingHand?: boolean;
  };
  defenderSide?: {
    isReflect?: boolean;
    isLightScreen?: boolean;
    isAuroraVeil?: boolean;
    isTailwind?: boolean;
  };
  attackerBoosts?: Partial<Record<string, number>>;
  defenderBoosts?: Partial<Record<string, number>>;
}

export interface DamageResult {
  minDamage: number;
  maxDamage: number;
  minPercent: number;
  maxPercent: number;
  koChance: {
    ohko: number;
    twohko: number;
    threehko: number;
    n: number;
  };
  description: string;
  rolls: number[];
}

function toSmogonWeather(
  w: string | null | undefined,
): "Sun" | "Rain" | "Sand" | "Snow" | undefined {
  if (!w) return undefined;
  const map: Record<string, "Sun" | "Rain" | "Sand" | "Snow"> = {
    sun: "Sun",
    rain: "Rain",
    sand: "Sand",
    snow: "Snow",
  };
  return map[w];
}

function toSmogonTerrain(
  t: string | null | undefined,
): "Electric" | "Grassy" | "Misty" | "Psychic" | undefined {
  if (!t) return undefined;
  const map: Record<string, "Electric" | "Grassy" | "Misty" | "Psychic"> = {
    electric: "Electric",
    grassy: "Grassy",
    misty: "Misty",
    psychic: "Psychic",
  };
  return map[t];
}

export function calculateDamage(
  attacker: TeamPokemon,
  defender: TeamPokemon,
  moveName: string,
  options: DamageCalcOptions = {},
): DamageResult | null {
  try {
    const atkPokemon = new Pokemon(GEN, attacker.species, {
      level: attacker.level,
      ability: attacker.ability,
      item: attacker.item,
      nature: attacker.nature,
      evs: attacker.evs,
      ivs: attacker.ivs,
      boosts: options.attackerBoosts,
    });

    const defPokemon = new Pokemon(GEN, defender.species, {
      level: defender.level,
      ability: defender.ability,
      item: defender.item,
      nature: defender.nature,
      evs: defender.evs,
      ivs: defender.ivs,
      boosts: options.defenderBoosts,
    });

    const move = new Move(GEN, moveName);

    const field = new Field({
      gameType: options.isDoubles ? "Doubles" : "Singles",
      weather: toSmogonWeather(options.weather),
      terrain: toSmogonTerrain(options.terrain),
      attackerSide: options.attackerSide || {},
      defenderSide: options.defenderSide || {},
    });

    const result = calculate(GEN, atkPokemon, defPokemon, move, field);

    const [minDmg, maxDmg] = result.range();
    const defHP = defPokemon.maxHP();
    const minPercent = (minDmg / defHP) * 100;
    const maxPercent = (maxDmg / defHP) * 100;

    const ko = result.kochance();

    // Extract all damage rolls
    const damage = result.damage;
    let rolls: number[] = [];
    if (Array.isArray(damage)) {
      if (Array.isArray(damage[0])) {
        rolls = (damage as number[][]).flat();
      } else {
        rolls = damage as number[];
      }
    } else {
      rolls = [damage as number];
    }

    return {
      minDamage: minDmg,
      maxDamage: maxDmg,
      minPercent: Math.round(minPercent * 10) / 10,
      maxPercent: Math.round(maxPercent * 10) / 10,
      koChance: {
        ohko: ko.n === 1 ? (ko.chance ?? 0) : 0,
        twohko: ko.n <= 2 ? (ko.chance ?? 0) : 0,
        threehko: ko.n <= 3 ? (ko.chance ?? 0) : 0,
        n: ko.n,
      },
      description: result.desc(),
      rolls,
    };
  } catch {
    return null;
  }
}
