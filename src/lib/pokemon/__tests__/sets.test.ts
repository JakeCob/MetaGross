import { describe, it, expect } from "vitest";
import { baseSpeciesFromMega } from "../sets";

describe("baseSpeciesFromMega", () => {
  it("strips a leading 'Mega ' prefix", () => {
    expect(baseSpeciesFromMega("Mega Floette")).toBe("Floette");
    expect(baseSpeciesFromMega("Mega Mawile")).toBe("Mawile");
  });

  it("strips a trailing '-Mega' / ' Mega' marker, incl. X/Y", () => {
    expect(baseSpeciesFromMega("Aerodactyl-Mega")).toBe("Aerodactyl");
    expect(baseSpeciesFromMega("Charizard-Mega-X")).toBe("Charizard");
    expect(baseSpeciesFromMega("Charizard-Mega-Y")).toBe("Charizard");
  });

  it("leaves non-mega species untouched (no false positives)", () => {
    expect(baseSpeciesFromMega("Floette")).toBe("Floette");
    expect(baseSpeciesFromMega("Meganium")).toBe("Meganium");
    expect(baseSpeciesFromMega("Rotom-Wash")).toBe("Rotom-Wash");
    expect(baseSpeciesFromMega("Basculegion-M")).toBe("Basculegion-M");
  });
});
