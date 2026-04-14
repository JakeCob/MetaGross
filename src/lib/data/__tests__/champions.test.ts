import { describe, expect, it } from "vitest";
import {
  canMegaEvolve,
  CHAMPIONS_MEGAS,
  getChampionsMegaEntriesForSpecies,
  getMegaFormFor,
  isChampionsPokemon,
} from "../champions";

describe("Champions mega helpers", () => {
  it("maps Starmie to its Champions Mega form", () => {
    expect(canMegaEvolve("Starmie")).toBe(true);
    expect(getMegaFormFor("Starmie", "Starminite")).toBe("Starmie-Mega");
    expect(getChampionsMegaEntriesForSpecies("Starmie")).toEqual([
      {
        megaSpecies: "Starmie-Mega",
        baseSpecies: "Starmie",
        stone: "Starminite",
        confirmed: true,
      },
    ]);
  });

  it("supports special base-species mappings", () => {
    expect(getMegaFormFor("Floette-Eternal", "Floettite")).toBe(
      "Floette-Mega",
    );
    expect(getMegaFormFor("Meowstic-F", "Meowsticite")).toBe(
      "Meowstic-F-Mega",
    );
    expect(isChampionsPokemon("Meowstic-Female")).toBe(true);
  });

  it("does not keep stale non-Bulbapedia mega entries", () => {
    expect(CHAMPIONS_MEGAS).not.toHaveProperty("Raichu");
    expect(CHAMPIONS_MEGAS).not.toHaveProperty("Staraptor");
    expect(CHAMPIONS_MEGAS).not.toHaveProperty("Typhlosion");
    expect(CHAMPIONS_MEGAS).not.toHaveProperty("Scolipede");
  });
});
