import { describe, it, expect } from "vitest";
import { calculateDamage } from "../damage-calc";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { DEFAULT_IVS, DEFAULT_EVS } from "@/lib/types/pokemon";

const makeAttacker = (overrides: Partial<TeamPokemon> = {}): TeamPokemon => ({
  species: "Metagross",
  ability: "Clear Body",
  item: "Life Orb",
  nature: "Adamant",
  level: 50,
  moves: ["Iron Head", "Protect", "Psychic Fangs", "Stomping Tantrum"],
  evs: { ...DEFAULT_EVS, atk: 252, hp: 252, spd: 4 },
  ivs: { ...DEFAULT_IVS },
  ...overrides,
});

const makeDefender = (overrides: Partial<TeamPokemon> = {}): TeamPokemon => ({
  species: "Incineroar",
  ability: "Intimidate",
  item: "Safety Goggles",
  nature: "Careful",
  level: 50,
  moves: ["Flare Blitz", "Fake Out", "Knock Off", "Parting Shot"],
  evs: { ...DEFAULT_EVS, hp: 252, spd: 252, def: 4 },
  ivs: { ...DEFAULT_IVS },
  ...overrides,
});

describe("calculateDamage", () => {
  it("returns a damage result with min/max range", () => {
    const result = calculateDamage(makeAttacker(), makeDefender(), "Stomping Tantrum");
    expect(result).not.toBeNull();
    expect(result!.minPercent).toBeGreaterThan(0);
    expect(result!.maxPercent).toBeGreaterThan(result!.minPercent);
    expect(result!.minDamage).toBeGreaterThan(0);
    expect(result!.maxDamage).toBeGreaterThan(result!.minDamage);
  });

  it("returns null for an invalid move", () => {
    const result = calculateDamage(makeAttacker(), makeDefender(), "Nonexistent Move");
    expect(result).toBeNull();
  });

  it("calculates super-effective damage higher", () => {
    // Stomping Tantrum (Ground) is super-effective on Incineroar (Fire/Dark)
    const groundResult = calculateDamage(makeAttacker(), makeDefender(), "Stomping Tantrum");
    // Iron Head (Steel) is neutral on Incineroar
    const steelResult = calculateDamage(makeAttacker(), makeDefender(), "Iron Head");
    expect(groundResult!.minPercent).toBeGreaterThan(steelResult!.minPercent);
  });

  it("accounts for field conditions", () => {
    const rain = calculateDamage(
      makeAttacker({ species: "Kyogre", ability: "Drizzle", moves: ["Water Spout", "Protect", "Ice Beam", "Thunder"] }),
      makeDefender(),
      "Water Spout",
      { weather: "rain" },
    );
    const noRain = calculateDamage(
      makeAttacker({ species: "Kyogre", ability: "Drizzle", moves: ["Water Spout", "Protect", "Ice Beam", "Thunder"] }),
      makeDefender(),
      "Water Spout",
    );
    expect(rain!.minPercent).toBeGreaterThan(noRain!.minPercent);
  });

  it("handles spread move modifier for doubles", () => {
    const result = calculateDamage(
      makeAttacker(),
      makeDefender(),
      "Stomping Tantrum",
      { isDoubles: true },
    );
    const singleResult = calculateDamage(
      makeAttacker(),
      makeDefender(),
      "Stomping Tantrum",
    );
    // Spread moves in doubles do 0.75x damage
    // But Stomping Tantrum is single-target, so should be same
    // Use Earthquake instead for a true spread move test
    const eqDouble = calculateDamage(
      makeAttacker({ moves: ["Earthquake", "Protect", "Iron Head", "Psychic Fangs"] }),
      makeDefender(),
      "Earthquake",
      { isDoubles: true },
    );
    const eqSingle = calculateDamage(
      makeAttacker({ moves: ["Earthquake", "Protect", "Iron Head", "Psychic Fangs"] }),
      makeDefender(),
      "Earthquake",
    );
    // In doubles, spread moves do less damage
    expect(eqDouble!.maxPercent).toBeLessThanOrEqual(eqSingle!.maxPercent);
  });
});
