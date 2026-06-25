import { describe, it, expect } from "vitest";
import { typeMatchup, multiplierLabel } from "../type-chart";
import { computeCoverage } from "../type-coverage";

describe("typeMatchup", () => {
  it("multiplies across dual types (4× weakness)", () => {
    // Grass/Steel (e.g. Ferrothorn) takes 2× from Fire on each — 4× total.
    expect(typeMatchup("Fire", ["Grass", "Steel"])).toBe(4);
  });

  it("yields ¼ from a double resist", () => {
    // Fire/Water-ish dual resist to Fire: Fire 0.5 × 0.5.
    expect(typeMatchup("Fire", ["Fire", "Water"])).toBe(0.25);
  });

  it("returns 0 for a type immunity (Flying vs Ground)", () => {
    expect(typeMatchup("Ground", ["Flying"])).toBe(0);
    expect(typeMatchup("Ghost", ["Normal"])).toBe(0);
  });

  it("applies ability immunities", () => {
    // Steel/Psychic (Bronzong) takes 2× from Ground; Levitate makes it immune.
    expect(typeMatchup("Ground", ["Steel", "Psychic"])).toBe(2);
    expect(typeMatchup("Ground", ["Steel", "Psychic"], "Levitate")).toBe(0);
    expect(typeMatchup("Water", ["Fire"], "Water Absorb")).toBe(0);
  });

  it("applies ability damage-halving (Thick Fat)", () => {
    expect(typeMatchup("Fire", ["Normal"], "Thick Fat")).toBe(0.5);
    expect(typeMatchup("Ice", ["Normal"], "Thick Fat")).toBe(0.5);
  });

  it("labels multipliers", () => {
    expect(multiplierLabel(4)).toBe("×4");
    expect(multiplierLabel(0)).toBe("immune");
    expect(multiplierLabel(0.25)).toBe("×¼");
  });
});

describe("computeCoverage", () => {
  it("flags a shared weakness when 3+ members are weak to a type", () => {
    // Three Grass-types — all weak to Fire.
    const cov = computeCoverage([
      { species: "Vileplume", types: ["Grass", "Poison"] },
      { species: "Tangrowth", types: ["Grass"] },
      { species: "Amoonguss", types: ["Grass", "Poison"] },
    ]);
    expect(cov.sharedWeaknesses).toContain("Fire");
    const fire = cov.rows.find((r) => r.type === "Fire")!;
    expect(fire.weak).toBe(3);
    expect(fire.shared).toBe(true);
    expect(fire.critical).toBe(true); // none resist Fire
  });

  it("does not flag when resists cover the weakness", () => {
    const cov = computeCoverage([
      { species: "Vileplume", types: ["Grass", "Poison"] }, // weak Fire
      { species: "Torkoal", types: ["Fire"] }, // resists Fire
      { species: "Incineroar", types: ["Fire", "Dark"] }, // resists Fire
    ]);
    const fire = cov.rows.find((r) => r.type === "Fire")!;
    expect(fire.weak).toBe(1);
    expect(fire.shared).toBe(false);
    expect(cov.sharedWeaknesses).not.toContain("Fire");
  });

  it("ignores members with no resolved typing", () => {
    const cov = computeCoverage([
      { species: "Pikachu", types: ["Electric"] },
      { species: "Unknown", types: [] },
    ]);
    expect(cov.members).toHaveLength(1);
  });
});
