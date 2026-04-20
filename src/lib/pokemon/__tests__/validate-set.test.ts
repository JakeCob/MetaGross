import { describe, it, expect } from "vitest";
import { validateSet } from "../validate-set";

describe("validateSet — ability alternatives", () => {
  it("accepts a single valid ability", () => {
    const result = validateSet({
      species: "Mega Scovillain",
      ability: "Spicy Spray",
      format: "champions-reg-m-a",
    });
    expect(result.warnings.filter((w) => w.kind === "ability-invalid")).toHaveLength(0);
  });

  it("accepts 'X or Y' when one alternative matches (regression)", () => {
    // Triggered by agent output: "Moody or Chlorophyll" flagged as invalid
    // even though Chlorophyll is a real Scovillain ability.
    const result = validateSet({
      species: "Mega Scovillain",
      ability: "Moody or Chlorophyll",
      format: "champions-reg-m-a",
    });
    expect(result.warnings.filter((w) => w.kind === "ability-invalid")).toHaveLength(0);
  });

  it("accepts 'X / Y' slash-separated alternatives", () => {
    const result = validateSet({
      species: "Mega Scovillain",
      ability: "Chlorophyll / Moody",
      format: "champions-reg-m-a",
    });
    expect(result.warnings.filter((w) => w.kind === "ability-invalid")).toHaveLength(0);
  });

  it("accepts 'X, Y, Z' comma-separated alternatives", () => {
    const result = validateSet({
      species: "Scovillain",
      ability: "Moody, Chlorophyll, Insomnia",
      format: "champions-reg-m-a",
    });
    expect(result.warnings.filter((w) => w.kind === "ability-invalid")).toHaveLength(0);
  });

  it("still flags genuinely invalid abilities", () => {
    const result = validateSet({
      species: "Mega Scovillain",
      ability: "Rough Skin",
      format: "champions-reg-m-a",
    });
    const abilityWarnings = result.warnings.filter((w) => w.kind === "ability-invalid");
    expect(abilityWarnings).toHaveLength(1);
    expect(abilityWarnings[0].message).toContain("Rough Skin");
  });

  it("flags when ALL alternatives are invalid", () => {
    const result = validateSet({
      species: "Mega Scovillain",
      ability: "Rough Skin or Download",
      format: "champions-reg-m-a",
    });
    expect(result.warnings.filter((w) => w.kind === "ability-invalid")).toHaveLength(1);
  });
});
