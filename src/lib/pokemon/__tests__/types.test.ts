import { describe, it, expect } from "vitest";
import { getTypeEffectiveness, getAllTypes } from "../types";

describe("getTypeEffectiveness", () => {
  it("Fire vs Grass = 2x", () => {
    expect(getTypeEffectiveness("Fire", ["Grass"])).toBe(2);
  });

  it("Fire vs [Grass, Steel] = 4x", () => {
    expect(getTypeEffectiveness("Fire", ["Grass", "Steel"])).toBe(4);
  });

  it("Normal vs Ghost = 0x", () => {
    expect(getTypeEffectiveness("Normal", ["Ghost"])).toBe(0);
  });

  it("Ground vs [Fire, Flying] = 0x (Flying immunity overrides)", () => {
    expect(getTypeEffectiveness("Ground", ["Fire", "Flying"])).toBe(0);
  });

  it("Electric vs Ground = 0x", () => {
    expect(getTypeEffectiveness("Electric", ["Ground"])).toBe(0);
  });

  it("Water vs [Fire, Rock] = 4x", () => {
    expect(getTypeEffectiveness("Water", ["Fire", "Rock"])).toBe(4);
  });

  it("Fighting vs [Normal, Ice] = 4x", () => {
    expect(getTypeEffectiveness("Fighting", ["Normal", "Ice"])).toBe(4);
  });

  it("Grass vs [Water, Ground] = 4x", () => {
    expect(getTypeEffectiveness("Grass", ["Water", "Ground"])).toBe(4);
  });

  it("Fire vs [Water, Rock] = 0.25x", () => {
    expect(getTypeEffectiveness("Fire", ["Water", "Rock"])).toBe(0.25);
  });

  it("returns 1 for empty defense types", () => {
    expect(getTypeEffectiveness("Fire", [])).toBe(1);
  });
});

describe("getAllTypes", () => {
  it("returns all standard types", () => {
    const types = getAllTypes();
    expect(types).toContain("Fire");
    expect(types).toContain("Water");
    expect(types).toContain("Grass");
    expect(types).toContain("Electric");
    expect(types).toContain("Normal");
    expect(types).toContain("Fairy");
    expect(types).toContain("Dragon");
    expect(types).toContain("Steel");
    expect(types.length).toBeGreaterThanOrEqual(18);
  });
});
