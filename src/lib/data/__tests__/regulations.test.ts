import { describe, it, expect } from "vitest";
import {
  ACTIVE_REGULATION,
  REGULATIONS,
  resolveRegulationId,
  getRegulation,
  isChampionsPokemon,
  isConfirmedNotInChampions,
  isChampionsItem,
  getMegaFormFor,
  getMegaAbility,
  getMegaAbilityFor,
  canMegaEvolve,
} from "../champions";

const M_A = "champions-reg-m-a";
const M_B = "champions-reg-m-b";

describe("regulation registry", () => {
  it("ships both M-A and M-B regulations", () => {
    expect(REGULATIONS["m-a"]).toBeDefined();
    expect(REGULATIONS["m-b"]).toBeDefined();
  });

  it("defaults the active regulation to M-B (new season)", () => {
    expect(ACTIVE_REGULATION).toBe("m-b");
  });

  it("resolves a regulation id from a format string", () => {
    expect(resolveRegulationId("Champions Reg M-A")).toBe("m-a");
    expect(resolveRegulationId("champions-reg-m-b")).toBe("m-b");
    expect(resolveRegulationId(undefined)).toBe("m-b"); // falls back to active
  });

  it("M-B is additive — every M-A-legal species is still legal in M-B", () => {
    for (const species of REGULATIONS["m-a"].pokemon) {
      expect(isChampionsPokemon(species, M_B)).toBe(true);
    }
  });
});

describe("M-B newly legal Pokemon", () => {
  const newSpecies = [
    "Metagross", "Mawile", "Swampert", "Blaziken", "Sceptile",
    "Annihilape", "Gholdengo", "Grimmsnarl", "Falinks", "Overqwil",
  ];

  it("are legal in M-B", () => {
    for (const s of newSpecies) {
      expect(isChampionsPokemon(s, M_B)).toBe(true);
    }
  });

  it("are NOT legal in M-A", () => {
    for (const s of newSpecies) {
      expect(isChampionsPokemon(s, M_A)).toBe(false);
    }
  });

  it("un-bans Metagross / Grimmsnarl / Gholdengo (in M-A banlist, not M-B)", () => {
    for (const s of ["Metagross", "Grimmsnarl", "Gholdengo"]) {
      expect(isConfirmedNotInChampions(s, M_A)).toBe(true);
      expect(isConfirmedNotInChampions(s, M_B)).toBe(false);
    }
  });
});

describe("M-B items", () => {
  it("un-bans Life Orb and the weather rocks in M-B only", () => {
    for (const item of ["Life Orb", "Wide Lens", "Light Clay", "Heat Rock"]) {
      expect(isChampionsItem(item, M_B)).toBe(true);
      expect(isChampionsItem(item, M_A)).toBe(false);
    }
  });

  it("adds the new mega stones in M-B only", () => {
    for (const stone of ["Metagrossite", "Mawilite", "Staraptite", "Falinksite"]) {
      expect(isChampionsItem(stone, M_B)).toBe(true);
      expect(isChampionsItem(stone, M_A)).toBe(false);
    }
  });

  it("confirms Raichunite X/Y in M-B (uncertain in M-A)", () => {
    expect(isChampionsItem("Raichunite X", M_B)).toBe(true);
    expect(isChampionsItem("Raichunite Y", M_B)).toBe(true);
  });
});

describe("M-B mega evolutions", () => {
  it("maps canonical new stones to mega forms in M-B", () => {
    expect(getMegaFormFor("Metagross", "Metagrossite", M_B)).toBe("Metagross-Mega");
    expect(getMegaFormFor("Mawile", "Mawilite", M_B)).toBe("Mawile-Mega");
    expect(getMegaFormFor("Swampert", "Swampertite", M_B)).toBe("Swampert-Mega");
  });

  it("maps invented Z-A stones to mega forms in M-B", () => {
    expect(getMegaFormFor("Falinks", "Falinksite", M_B)).toBe("Falinks-Mega");
    expect(getMegaFormFor("Barbaracle", "Barbaracite", M_B)).toBe("Barbaracle-Mega");
    expect(getMegaFormFor("Dragalge", "Dragalgite", M_B)).toBe("Dragalge-Mega");
  });

  it("does NOT allow the new megas in M-A", () => {
    expect(getMegaFormFor("Metagross", "Metagrossite", M_A)).toBeNull();
    expect(canMegaEvolve("Falinks", M_A)).toBe(false);
    expect(canMegaEvolve("Falinks", M_B)).toBe(true);
  });
});

describe("mega signature abilities", () => {
  it("returns the Champions signature ability for invented megas", () => {
    expect(getMegaAbility("Eelektross-Mega")).toBe("Eelevate");
    expect(getMegaAbility("Scovillain-Mega")).toBe("Spicy Spray");
    expect(getMegaAbility("Pyroar-Mega")).toBe("Fire Mane");
  });

  it("returns null for real Gen-6 megas (the dex ability is correct)", () => {
    // Metagross-Mega → Tough Claws, Mawile-Mega → Huge Power come straight
    // from @pkmn/dex, so we must NOT override them.
    expect(getMegaAbility("Metagross-Mega")).toBeNull();
    expect(getMegaAbility("Mawile-Mega")).toBeNull();
    expect(getMegaAbility("Garchomp-Mega")).toBeNull();
  });

  it("resolves the mega ability from base species + held stone", () => {
    expect(getMegaAbilityFor("Eelektross", "Eelektrossite", M_B)).toBe("Eelevate");
    expect(getMegaAbilityFor("Falinks", "Falinksite", M_B)).toBe("Defiant");
    // Not a mega in M-A → no ability.
    expect(getMegaAbilityFor("Eelektross", "Eelektrossite", M_A)).toBeNull();
    // Wrong/none item → no mega → null.
    expect(getMegaAbilityFor("Eelektross", "Leftovers", M_B)).toBeNull();
  });
});

describe("active-regulation back-compat helpers", () => {
  it("treat a no-format call as M-B", () => {
    expect(isChampionsPokemon("Metagross")).toBe(true); // active = M-B
    expect(isChampionsItem("Life Orb")).toBe(true);
  });

  it("expose the M-B period on the active regulation", () => {
    expect(getRegulation().rules.period).toContain("September");
  });
});
