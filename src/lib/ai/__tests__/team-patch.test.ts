import { describe, expect, it } from "vitest";
import { applyPokemonPatchToTeam } from "../graph/team-patch";

describe("applyPokemonPatchToTeam", () => {
  const baseTeam = [
    {
      species: "Floette-Eternal",
      ability: "Flower Veil",
      item: "Floettite",
      nature: "Calm",
      level: 50,
      moves: ["Moonblast", "Protect", "Helping Hand", "Wish"],
      evs: { hp: 32, atk: 0, def: 20, spa: 0, spd: 14, spe: 0 },
      ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
    },
    {
      species: "Milotic",
      ability: "Competitive",
      item: "Leftovers",
      nature: "Bold",
      level: 50,
      moves: ["Scald", "Recover", "Haze", "Protect"],
      evs: { hp: 32, atk: 0, def: 24, spa: 0, spd: 10, spe: 0 },
      ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
    },
    {
      species: "Incineroar",
      ability: "Intimidate",
      item: "Sitrus Berry",
      nature: "Careful",
      level: 50,
      moves: ["Fake Out", "Flare Blitz", "Parting Shot", "Protect"],
      evs: { hp: 32, atk: 8, def: 8, spa: 0, spd: 18, spe: 0 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    },
  ];

  it("replaces one species while preserving untouched teammates", () => {
    const patched = applyPokemonPatchToTeam(baseTeam, {
      teamId: "team-1",
      species: "Incineroar",
      patch: {
        species: "Farigiraf",
      },
    });

    expect(patched[0].species).toBe("Floette-Eternal");
    expect(patched[1].species).toBe("Milotic");
    expect(patched[2].species).toBe("Farigiraf");
    expect(patched[2].ability).toBe("");
    expect(patched[2].item).toBe("");
    expect(patched[2].moves).toEqual(["", "", "", ""]);
  });

  it("applies move-only patches without changing other fields", () => {
    const patched = applyPokemonPatchToTeam(baseTeam, {
      teamId: "team-1",
      species: "Milotic",
      patch: {
        moves: ["Scald", "Recover", "Haze", "Wide Guard"],
      },
    });

    expect(patched[1].species).toBe("Milotic");
    expect(patched[1].item).toBe("Leftovers");
    expect(patched[1].moves).toEqual([
      "Scald",
      "Recover",
      "Haze",
      "Wide Guard",
    ]);
  });
});
