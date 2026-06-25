import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { scoreMatchup } from "../tournament-sim";
import type { TeamPokemon, EVSpread } from "@/lib/types/pokemon";
import type { MetaTeam } from "@/lib/meta-teams/types";

const FLAT = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
function mon(
  species: string,
  moves: string[],
  evs: Partial<EVSpread>,
  nature: string,
  item: string,
  ability: string,
): TeamPokemon {
  return {
    species,
    ability,
    item,
    nature,
    level: 50,
    moves: [moves[0] ?? "", moves[1] ?? "", moves[2] ?? "", moves[3] ?? ""],
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...evs },
    ivs: { ...FLAT },
  };
}

const META: MetaTeam = {
  id: "t1",
  source: "limitless",
  sourceRef: null,
  sourceUrl: null,
  format: "champions-reg-m-b",
  author: "tester",
  record: "8-0",
  archetype: "Balance",
  description: null,
  speciesFingerprint: "x",
  species: ["Incineroar"],
  pokemon: [],
  trust: 0.9,
  seenAt: null,
  createdAt: 0,
  updatedAt: 0,
};

describe("scoreMatchup", () => {
  it("produces a bounded score, valid label, and a worst-threat shape", () => {
    const user = [
      mon("Garchomp", ["Earthquake", "Rock Slide", "Protect", "Dragon Claw"], { atk: 252, spe: 252 }, "Jolly", "Life Orb", "Rough Skin"),
    ];
    const opp = [
      mon("Incineroar", ["Fake Out", "Flare Blitz", "Parting Shot", "Darkest Lariat"], { hp: 244, spd: 252 }, "Careful", "Sitrus Berry", "Intimidate"),
    ];
    const m = scoreMatchup(user, opp, META);

    expect(m.score).toBeGreaterThanOrEqual(3);
    expect(m.score).toBeLessThanOrEqual(97);
    expect(["Favorable", "Even", "Tricky", "Hard"]).toContain(m.label);
    expect(m.youThreaten).toBeGreaterThanOrEqual(0);
    expect(m.youThreaten).toBeLessThanOrEqual(opp.length);
    expect(m.worstThreat).not.toBeNull();
    expect(m.worstThreat?.target).toBe("Garchomp");
    expect(m.speedNote).toMatch(/outspeed/);

    // Detail matrix: one row per attacker, one cell per defender, both directions.
    expect(m.detail.yourHits).toHaveLength(user.length);
    expect(m.detail.yourHits[0].vs).toHaveLength(opp.length);
    expect(m.detail.theirHits).toHaveLength(opp.length);
    expect(m.detail.theirHits[0].vs[0]).toMatchObject({ target: "Garchomp" });
  });

  it("favors a team that OHKOs the opponent while outspeeding it", () => {
    // Fast, hard-hitting attacker vs a frail, slow target it OHKOs SE.
    const user = [
      mon("Flutter Mane", ["Moonblast", "Shadow Ball", "Protect", "Dazzling Gleam"], { spa: 252, spe: 252 }, "Timid", "Choice Specs", "Protosynthesis"),
    ];
    const opp = [
      mon("Dragapult", ["Dragon Darts", "Phantom Force", "Protect", "U-turn"], {}, "Hardy", "", "Clear Body"),
    ];
    const m = scoreMatchup(user, opp, META);
    expect(m.youThreaten).toBe(1); // Moonblast OHKOs a 0-EV Dragapult (Dragon weak to Fairy)
  });

  it("applies the user's field — Sun never lowers Fire damage, TR flips the speed note", () => {
    const fire = [
      mon("Charizard", ["Heat Wave", "Flamethrower", "Air Slash", "Protect"], { spa: 252, spe: 252 }, "Timid", "Choice Specs", "Blaze"),
    ];
    const opp = [
      mon("Garchomp", ["Earthquake", "Rock Slide", "Dragon Claw", "Protect"], {}, "Hardy", "", "Rough Skin"),
    ];
    const noSun = scoreMatchup(fire, opp, META, { weather: null, tailwind: false, trickRoom: false });
    const sun = scoreMatchup(fire, opp, META, { weather: "sun", tailwind: false, trickRoom: false });
    expect(sun.youThreaten).toBeGreaterThanOrEqual(noSun.youThreaten);

    const tr = scoreMatchup(fire, opp, META, { weather: null, tailwind: false, trickRoom: true });
    expect(tr.speedNote).toMatch(/Trick Room/);
  });
});
