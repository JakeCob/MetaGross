import { describe, it, expect } from "vitest";
import {
  teamPokemonSchema,
  teamSchema,
  validateTeam,
} from "../team";

const validPokemon = {
  species: "Metagross",
  ability: "Clear Body",
  item: "Metagrossite",
  nature: "Jolly",
  level: 50,
  moves: ["Heavy Slam", "Protect", "Psychic Fangs", "Stomping Tantrum"],
  evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
};

const makeTeam = (overrides: Record<number, Record<string, unknown>> = {}) => {
  const pokemon = [
    { ...validPokemon, species: "Metagross", item: "Metagrossite" },
    { ...validPokemon, species: "Incineroar", item: "Safety Goggles" },
    { ...validPokemon, species: "Rillaboom", item: "Miracle Seed" },
    { ...validPokemon, species: "Garchomp", item: "Life Orb" },
    { ...validPokemon, species: "Sinistcha", item: "Focus Sash" },
    { ...validPokemon, species: "Sneasler", item: "Covert Cloak" },
  ].map((p, i) => ({ ...p, ...(overrides[i] || {}) }));
  return {
    name: "Test Team",
    format: "champions-reg-m-a",
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
    const team = makeTeam({ 1: { species: "Metagross" } });
    const result = teamSchema.safeParse(team);
    expect(result.success).toBe(false);
  });

  it("rejects duplicate items (Item Clause)", () => {
    const team = makeTeam({ 1: { item: "Metagrossite" } });
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
