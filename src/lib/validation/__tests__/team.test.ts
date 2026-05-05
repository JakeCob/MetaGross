import { describe, it, expect } from "vitest";
import {
  teamPokemonSchema,
  teamSchema,
  validateTeam,
} from "../team";

// Items here must be on the Champions authoritative list in
// src/lib/data/champions.ts — the team validator rejects anything
// else when format includes "Champions". Don't revert to VGC
// staples like Safety Goggles or Clear Amulet; those are banned.
const validPokemon = {
  species: "Incineroar",
  ability: "Intimidate",
  item: "Sitrus Berry",
  nature: "Careful",
  level: 50,
  moves: ["Fake Out", "Flare Blitz", "Darkest Lariat", "Parting Shot"],
  evs: { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
};

const makeTeam = (overrides: Record<number, Record<string, unknown>> = {}) => {
  const pokemon = [
    { ...validPokemon, species: "Incineroar", item: "Sitrus Berry" },
    { ...validPokemon, species: "Starmie", ability: "Illuminate", item: "Starminite", nature: "Timid", moves: ["Hydro Pump", "Psychic", "Ice Beam", "Protect"], evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 } },
    { ...validPokemon, species: "Garchomp", ability: "Rough Skin", item: "Focus Sash", nature: "Jolly", moves: ["Earthquake", "Dragon Claw", "Rock Slide", "Protect"], evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 } },
    { ...validPokemon, species: "Sinistcha", ability: "Hospitality", item: "Leftovers", nature: "Calm", moves: ["Matcha Gotcha", "Rage Powder", "Trick Room", "Protect"], evs: { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 } },
    { ...validPokemon, species: "Sneasler", ability: "Unburden", item: "White Herb", nature: "Jolly", moves: ["Dire Claw", "Close Combat", "Acrobatics", "Protect"], evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 } },
    { ...validPokemon, species: "Dragonite", ability: "Inner Focus", item: "Dragoninite", nature: "Adamant", moves: ["Extreme Speed", "Scale Shot", "Ice Spinner", "Protect"], evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 } },
  ].map((p, i) => ({ ...p, ...(overrides[i] || {}) }));
  return {
    name: "Test Team",
    format: "Champions Reg M-A",
    pokemon,
  };
};

describe("teamPokemonSchema", () => {
  it("accepts a valid Pokemon", () => {
    const result = teamPokemonSchema.safeParse(validPokemon);
    expect(result.success).toBe(true);
  });

  it("rejects EV total exceeding 510", () => {
    const pokemon = {
      ...validPokemon,
      evs: { hp: 252, atk: 252, def: 252, spa: 0, spd: 0, spe: 0 },
    };
    const result = teamPokemonSchema.safeParse(pokemon);
    expect(result.success).toBe(false);
  });

  it("rejects single EV exceeding 252", () => {
    const pokemon = {
      ...validPokemon,
      evs: { hp: 253, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    };
    const result = teamPokemonSchema.safeParse(pokemon);
    expect(result.success).toBe(false);
  });

  it("rejects fewer than 1 move", () => {
    const pokemon = { ...validPokemon, moves: [] };
    const result = teamPokemonSchema.safeParse(pokemon);
    expect(result.success).toBe(false);
  });

  it("rejects more than 4 moves", () => {
    const pokemon = {
      ...validPokemon,
      moves: ["a", "b", "c", "d", "e"],
    };
    const result = teamPokemonSchema.safeParse(pokemon);
    expect(result.success).toBe(false);
  });

  it("rejects empty species name", () => {
    const pokemon = { ...validPokemon, species: "" };
    const result = teamPokemonSchema.safeParse(pokemon);
    expect(result.success).toBe(false);
  });

  it("rejects IV exceeding 31", () => {
    const pokemon = {
      ...validPokemon,
      ivs: { hp: 32, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    };
    const result = teamPokemonSchema.safeParse(pokemon);
    expect(result.success).toBe(false);
  });

  it("accepts level between 1 and 100", () => {
    const at1 = teamPokemonSchema.safeParse({ ...validPokemon, level: 1 });
    const at100 = teamPokemonSchema.safeParse({ ...validPokemon, level: 100 });
    expect(at1.success).toBe(true);
    expect(at100.success).toBe(true);
  });

  it("rejects level outside 1-100", () => {
    const at0 = teamPokemonSchema.safeParse({ ...validPokemon, level: 0 });
    const at101 = teamPokemonSchema.safeParse({ ...validPokemon, level: 101 });
    expect(at0.success).toBe(false);
    expect(at101.success).toBe(false);
  });
});

describe("teamSchema", () => {
  it("accepts a valid team of 6", () => {
    const result = teamSchema.safeParse(makeTeam());
    expect(result.success).toBe(true);
  });

  it("rejects empty team name", () => {
    const team = makeTeam();
    team.name = "";
    const result = teamSchema.safeParse(team);
    expect(result.success).toBe(false);
  });

  it("rejects fewer than 1 Pokemon", () => {
    const team = makeTeam();
    team.pokemon = [];
    const result = teamSchema.safeParse(team);
    expect(result.success).toBe(false);
  });

  it("rejects more than 6 Pokemon", () => {
    const team = makeTeam();
    team.pokemon.push({
      ...validPokemon,
      species: "Pikachu",
      item: "Light Ball",
    });
    const result = teamSchema.safeParse(team);
    expect(result.success).toBe(false);
  });

  it("rejects duplicate species (Species Clause)", () => {
    const team = makeTeam({ 1: { species: "Incineroar" } });
    const result = teamSchema.safeParse(team);
    expect(result.success).toBe(false);
  });

  it("rejects duplicate items (Item Clause)", () => {
    const team = makeTeam({ 1: { item: "Safety Goggles" } });
    const result = teamSchema.safeParse(team);
    expect(result.success).toBe(false);
  });

  it("rejects baby Pokemon in Champions", () => {
    const team = makeTeam({ 1: { species: "Pichu" } });
    const result = teamSchema.safeParse(team);
    expect(result.success).toBe(false);
  });

  it("rejects middle-stage evolutions in Champions", () => {
    const team = makeTeam({ 1: { species: "Chansey" } });
    const result = teamSchema.safeParse(team);
    expect(result.success).toBe(false);
  });

  it("rejects illegal Champions items", () => {
    const team = makeTeam({ 1: { item: "Mawilite" } });
    const result = teamSchema.safeParse(team);
    expect(result.success).toBe(false);
  });
});

describe("validateTeam", () => {
  it("returns success for a valid team", () => {
    const result = validateTeam(makeTeam());
    expect(result.success).toBe(true);
  });

  it("returns errors for an invalid team", () => {
    const team = makeTeam();
    team.name = "";
    const result = validateTeam(team);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
