import { describe, it, expect } from "vitest";
import { calculateWinProbability, type GameState } from "../win-prob";
import type { FieldState } from "@/lib/types/battle";
import { DEFAULT_FIELD_STATE } from "@/lib/types/battle";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { DEFAULT_EVS, DEFAULT_IVS } from "@/lib/types/pokemon";

function makePokemon(
  species: string,
  hpPercent: number,
  isFainted = false,
): GameState["p1Pokemon"][number] {
  return { species, hpPercent, isFainted };
}

function makeTeamPokemon(overrides: Partial<TeamPokemon> = {}): TeamPokemon {
  return {
    species: "Metagross",
    ability: "Clear Body",
    item: "Life Orb",
    nature: "Adamant",
    level: 50,
    moves: ["Iron Head", "Protect", "Psychic Fangs", "Stomping Tantrum"],
    evs: { ...DEFAULT_EVS, atk: 252, hp: 252, spe: 4 },
    ivs: { ...DEFAULT_IVS },
    ...overrides,
  };
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    p1Pokemon: [
      makePokemon("Metagross", 100),
      makePokemon("Incineroar", 100),
      makePokemon("Kyogre", 100),
      makePokemon("Rillaboom", 100),
    ],
    p2Pokemon: [
      makePokemon("Zacian", 100),
      makePokemon("Groudon", 100),
      makePokemon("Calyrex-Shadow", 100),
      makePokemon("Whimsicott", 100),
    ],
    fieldState: { ...DEFAULT_FIELD_STATE },
    p1Team: [
      makeTeamPokemon({ species: "Metagross" }),
      makeTeamPokemon({ species: "Incineroar", ability: "Intimidate", moves: ["Flare Blitz", "Fake Out", "Knock Off", "Parting Shot"] }),
      makeTeamPokemon({ species: "Kyogre", ability: "Drizzle", moves: ["Water Spout", "Ice Beam", "Thunder", "Protect"] }),
      makeTeamPokemon({ species: "Rillaboom", ability: "Grassy Surge", moves: ["Grassy Glide", "Wood Hammer", "Fake Out", "U-turn"] }),
    ],
    p2Team: [
      makeTeamPokemon({ species: "Zacian", ability: "Intrepid Sword", moves: ["Behemoth Blade", "Play Rough", "Sacred Sword", "Protect"] }),
      makeTeamPokemon({ species: "Groudon", ability: "Drought", moves: ["Precipice Blades", "Heat Crash", "Rock Slide", "Protect"] }),
      makeTeamPokemon({ species: "Calyrex-Shadow", ability: "As One (Spectrier)", moves: ["Astral Barrage", "Psyshock", "Nasty Plot", "Protect"] }),
      makeTeamPokemon({ species: "Whimsicott", ability: "Prankster", moves: ["Tailwind", "Moonblast", "Helping Hand", "Encore"] }),
    ],
    ...overrides,
  };
}

describe("calculateWinProbability", () => {
  it("returns > 65% when P1 has 4 Pokemon vs P2 has 2", () => {
    const state = makeGameState({
      p2Pokemon: [
        makePokemon("Zacian", 100),
        makePokemon("Groudon", 100),
        makePokemon("Calyrex-Shadow", 0, true),
        makePokemon("Whimsicott", 0, true),
      ],
    });

    const prob = calculateWinProbability(state);
    expect(prob).toBeGreaterThan(65);
  });

  it("returns < 35% when P1 has 2 Pokemon vs P2 has 4", () => {
    const state = makeGameState({
      p1Pokemon: [
        makePokemon("Metagross", 100),
        makePokemon("Incineroar", 100),
        makePokemon("Kyogre", 0, true),
        makePokemon("Rillaboom", 0, true),
      ],
    });

    const prob = calculateWinProbability(state);
    expect(prob).toBeLessThan(35);
  });

  it("returns ~50% (45-55 range) with equal Pokemon count and equal HP", () => {
    // Use symmetric teams for a fair comparison
    const state = makeGameState({
      p1Pokemon: [
        makePokemon("Metagross", 100),
        makePokemon("Incineroar", 100),
        makePokemon("Kyogre", 100),
        makePokemon("Rillaboom", 100),
      ],
      p2Pokemon: [
        makePokemon("Metagross", 100),
        makePokemon("Incineroar", 100),
        makePokemon("Kyogre", 100),
        makePokemon("Rillaboom", 100),
      ],
      p1Team: [
        makeTeamPokemon({ species: "Metagross" }),
        makeTeamPokemon({ species: "Incineroar", ability: "Intimidate", moves: ["Flare Blitz", "Fake Out", "Knock Off", "Parting Shot"] }),
        makeTeamPokemon({ species: "Kyogre", ability: "Drizzle", moves: ["Water Spout", "Ice Beam", "Thunder", "Protect"] }),
        makeTeamPokemon({ species: "Rillaboom", ability: "Grassy Surge", moves: ["Grassy Glide", "Wood Hammer", "Fake Out", "U-turn"] }),
      ],
      p2Team: [
        makeTeamPokemon({ species: "Metagross" }),
        makeTeamPokemon({ species: "Incineroar", ability: "Intimidate", moves: ["Flare Blitz", "Fake Out", "Knock Off", "Parting Shot"] }),
        makeTeamPokemon({ species: "Kyogre", ability: "Drizzle", moves: ["Water Spout", "Ice Beam", "Thunder", "Protect"] }),
        makeTeamPokemon({ species: "Rillaboom", ability: "Grassy Surge", moves: ["Grassy Glide", "Wood Hammer", "Fake Out", "U-turn"] }),
      ],
    });

    const prob = calculateWinProbability(state);
    expect(prob).toBeGreaterThanOrEqual(45);
    expect(prob).toBeLessThanOrEqual(55);
  });

  it("returns 100 when all P2 Pokemon are fainted", () => {
    const state = makeGameState({
      p2Pokemon: [
        makePokemon("Zacian", 0, true),
        makePokemon("Groudon", 0, true),
        makePokemon("Calyrex-Shadow", 0, true),
        makePokemon("Whimsicott", 0, true),
      ],
    });

    const prob = calculateWinProbability(state);
    expect(prob).toBe(100);
  });

  it("returns 0 when all P1 Pokemon are fainted", () => {
    const state = makeGameState({
      p1Pokemon: [
        makePokemon("Metagross", 0, true),
        makePokemon("Incineroar", 0, true),
        makePokemon("Kyogre", 0, true),
        makePokemon("Rillaboom", 0, true),
      ],
    });

    const prob = calculateWinProbability(state);
    expect(prob).toBe(0);
  });

  it("gives higher probability to the side with full HP vs low HP", () => {
    const healthyP1 = makeGameState({
      p1Pokemon: [
        makePokemon("Metagross", 100),
        makePokemon("Incineroar", 100),
        makePokemon("Kyogre", 100),
        makePokemon("Rillaboom", 100),
      ],
      p2Pokemon: [
        makePokemon("Zacian", 15),
        makePokemon("Groudon", 20),
        makePokemon("Calyrex-Shadow", 10),
        makePokemon("Whimsicott", 25),
      ],
    });

    const prob = calculateWinProbability(healthyP1);
    expect(prob).toBeGreaterThan(65);
  });

  it("is clamped between 5 and 95 when both sides have Pokemon", () => {
    // Even with a massive advantage, should not exceed 95
    const state = makeGameState({
      p1Pokemon: [
        makePokemon("Metagross", 100),
        makePokemon("Incineroar", 100),
        makePokemon("Kyogre", 100),
        makePokemon("Rillaboom", 100),
      ],
      p2Pokemon: [
        makePokemon("Zacian", 0, true),
        makePokemon("Groudon", 0, true),
        makePokemon("Calyrex-Shadow", 0, true),
        makePokemon("Whimsicott", 5),
      ],
    });

    const prob = calculateWinProbability(state);
    expect(prob).toBeGreaterThanOrEqual(5);
    expect(prob).toBeLessThanOrEqual(95);
  });
});
