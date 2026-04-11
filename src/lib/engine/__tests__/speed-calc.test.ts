import { describe, it, expect } from "vitest";
import { getEffectiveSpeed, compareSpeed } from "../speed-calc";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { DEFAULT_IVS, DEFAULT_EVS } from "@/lib/types/pokemon";
import type { FieldState } from "@/lib/types/battle";
import { DEFAULT_FIELD_STATE } from "@/lib/types/battle";

const makePokemon = (
  species: string,
  spe: number,
  nature: string = "Jolly",
  overrides: Partial<TeamPokemon> = {},
): TeamPokemon => ({
  species,
  ability: "Clear Body",
  item: "Life Orb",
  nature,
  level: 50,
  moves: ["Protect", "Protect", "Protect", "Protect"],
  evs: { ...DEFAULT_EVS, spe },
  ivs: { ...DEFAULT_IVS },
  ...overrides,
});

describe("getEffectiveSpeed", () => {
  it("calculates base speed stat correctly", () => {
    // Metagross base 70, 252 Spe Jolly at level 50
    const speed = getEffectiveSpeed(makePokemon("Metagross", 252, "Jolly"));
    // floor((floor((2*70 + 31 + floor(252/4)) * 50/100) + 5) * 1.1) = floor((floor(233*0.5)+5)*1.1) = floor(121.5*1.1) = 134
    expect(speed).toBe(134);
  });

  it("accounts for paralysis", () => {
    const normal = getEffectiveSpeed(makePokemon("Metagross", 252, "Jolly"));
    const paralyzed = getEffectiveSpeed(
      makePokemon("Metagross", 252, "Jolly"),
      DEFAULT_FIELD_STATE,
      "paralysis",
    );
    expect(paralyzed).toBeLessThan(normal);
    // Paralysis halves speed (Gen 7+)
    expect(paralyzed).toBe(Math.floor(normal / 2));
  });

  it("accounts for Tailwind (doubles speed)", () => {
    const normal = getEffectiveSpeed(makePokemon("Metagross", 252, "Jolly"));
    const tailwind: FieldState = { ...DEFAULT_FIELD_STATE, tailwindP1: true };
    const boosted = getEffectiveSpeed(
      makePokemon("Metagross", 252, "Jolly"),
      tailwind,
      null,
      "p1",
    );
    expect(boosted).toBe(normal * 2);
  });

  it("accounts for Choice Scarf (1.5x speed)", () => {
    const speed = getEffectiveSpeed(
      makePokemon("Metagross", 252, "Jolly", { item: "Choice Scarf" }),
    );
    const baseSpeed = getEffectiveSpeed(
      makePokemon("Metagross", 252, "Jolly", { item: "Life Orb" }),
    );
    expect(speed).toBe(Math.floor(baseSpeed * 1.5));
  });
});

describe("compareSpeed", () => {
  it("faster Pokemon wins", () => {
    // Garchomp base 102 vs Metagross base 70 — both max speed Jolly
    const garchomp = makePokemon("Garchomp", 252, "Jolly");
    const metagross = makePokemon("Metagross", 252, "Jolly");
    expect(compareSpeed(garchomp, metagross)).toBe("a");
  });

  it("slower Pokemon wins in Trick Room", () => {
    const garchomp = makePokemon("Garchomp", 252, "Jolly");
    const metagross = makePokemon("Metagross", 252, "Jolly");
    const trickRoom: FieldState = { ...DEFAULT_FIELD_STATE, trickRoom: true };
    expect(compareSpeed(garchomp, metagross, trickRoom)).toBe("b");
  });

  it("returns tie for equal speed", () => {
    const mon1 = makePokemon("Metagross", 252, "Jolly");
    const mon2 = makePokemon("Metagross", 252, "Jolly");
    expect(compareSpeed(mon1, mon2)).toBe("tie");
  });

  it("Tailwind overrides base speed disadvantage", () => {
    // Metagross with Tailwind vs Garchomp without
    const metagross = makePokemon("Metagross", 252, "Jolly");
    const garchomp = makePokemon("Garchomp", 252, "Jolly");
    const tailwindP1: FieldState = { ...DEFAULT_FIELD_STATE, tailwindP1: true };
    // Metagross is 'a', Garchomp is 'b'. Tailwind on P1 side.
    expect(compareSpeed(metagross, garchomp, tailwindP1, "p1", "p2")).toBe("a");
  });
});
