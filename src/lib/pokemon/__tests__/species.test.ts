import { describe, it, expect } from "vitest";
import { getSpecies, searchSpecies } from "../species";

describe("getSpecies", () => {
  it("returns correct data for Metagross", () => {
    const metagross = getSpecies("Metagross");
    expect(metagross).not.toBeNull();
    expect(metagross!.name).toBe("Metagross");
    expect(metagross!.types).toEqual(["Steel", "Psychic"]);
    expect(metagross!.baseStats).toEqual({
      hp: 80,
      atk: 135,
      def: 130,
      spa: 95,
      spd: 90,
      spe: 70,
    });
  });

  it("returns null for nonexistent species", () => {
    const result = getSpecies("nonexistent");
    expect(result).toBeNull();
  });

  it("returns abilities for a species", () => {
    const metagross = getSpecies("Metagross");
    expect(metagross).not.toBeNull();
    expect(metagross!.abilities.length).toBeGreaterThan(0);
    expect(metagross!.abilities).toContain("Clear Body");
  });
});

describe("searchSpecies", () => {
  it("finds Metagross when searching 'Meta'", () => {
    const results = searchSpecies("Meta");
    const names = results.map((s) => s.name);
    expect(names).toContain("Metagross");
  });

  it("returns empty array for empty query", () => {
    const results = searchSpecies("");
    expect(results).toEqual([]);
  });

  it("respects the limit parameter", () => {
    const results = searchSpecies("M", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("is case-insensitive", () => {
    const results = searchSpecies("meta");
    const names = results.map((s) => s.name);
    expect(names).toContain("Metagross");
  });
});
