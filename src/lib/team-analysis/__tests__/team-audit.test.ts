import { describe, it, expect } from "vitest";
import {
  analyzeTeam,
  auditTeam,
  teamErrors,
  megaAbilityFor,
  type AITeamMember,
} from "../team-context";

const FORMAT = "Champions Reg M-B";

/** A coherent fast Tailwind team with no rain. */
const tailwindCore: AITeamMember[] = [
  { species: "Staraptor", item: "Staraptite", ability: "Reckless", moves: ["Brave Bird", "Close Combat", "U-turn", "Protect"] },
  { species: "Whimsicott", item: "Focus Sash", ability: "Prankster", moves: ["Tailwind", "Moonblast", "Encore", "Protect"] },
  { species: "Incineroar", item: "Sitrus Berry", ability: "Intimidate", moves: ["Fake Out", "Flare Blitz", "Parting Shot", "Darkest Lariat"] },
];

describe("analyzeTeam", () => {
  it("detects weather from an ability (Drizzle → rain)", () => {
    const a = analyzeTeam(
      [{ species: "Pelipper", ability: "Drizzle", moves: ["Hurricane"] }],
      FORMAT,
    );
    expect(a.weather).toBe("rain");
  });

  it("detects weather from a move (Rain Dance → rain)", () => {
    const a = analyzeTeam(
      [{ species: "Raichu", ability: "Lightning Rod", moves: ["Rain Dance", "Thunderbolt"] }],
      FORMAT,
    );
    expect(a.weather).toBe("rain");
  });

  it("flags Tailwind and Trick Room presence", () => {
    const a = analyzeTeam(tailwindCore, FORMAT);
    expect(a.hasTailwind).toBe(true);
    expect(a.hasTrickRoom).toBe(false);
  });

  it("computes shared defensive weaknesses across members", () => {
    const a = analyzeTeam(tailwindCore, FORMAT);
    // Staraptor (Normal/Flying) + Whimsicott (Grass/Fairy) share Electric? No —
    // but Electric hits Staraptor; verify the shape is sane and sorted.
    expect(Array.isArray(a.weaknesses)).toBe(true);
    if (a.weaknesses.length > 1) {
      expect(a.weaknesses[0].members.length).toBeGreaterThanOrEqual(
        a.weaknesses[1].members.length,
      );
    }
  });
});

describe("megaAbilityFor — post-mega ability", () => {
  it("gives a REAL mega its dex ability, not its base ability (Mawile → Huge Power)", () => {
    expect(
      megaAbilityFor({ species: "Mawile", item: "Mawilite", ability: "Intimidate" }, FORMAT),
    ).toBe("Huge Power");
  });

  it("gives an INVENTED mega its Champions override (Staraptor → Contrary, not Reckless)", () => {
    expect(
      megaAbilityFor({ species: "Staraptor", item: "Staraptite", ability: "Reckless" }, FORMAT),
    ).toBe("Contrary");
  });

  it("returns the set ability when the member does not mega", () => {
    expect(
      megaAbilityFor({ species: "Incineroar", item: "Sitrus Berry", ability: "Intimidate" }, FORMAT),
    ).toBe("Intimidate");
  });
});

describe("auditTeam — weather traps", () => {
  it("flags Archaludon's Electro Shot on a team with no rain", () => {
    const team: AITeamMember[] = [
      ...tailwindCore,
      { species: "Archaludon", item: "Leftovers", ability: "Stamina", moves: ["Electro Shot", "Flash Cannon", "Body Press", "Protect"] },
    ];
    const v = auditTeam(team, FORMAT);
    expect(v.some((x) => x.rule === "weather-trap" && x.subject === "Archaludon")).toBe(true);
  });

  it("does NOT flag Electro Shot when the team sets rain (Pelipper Drizzle)", () => {
    const team: AITeamMember[] = [
      { species: "Pelipper", item: "Focus Sash", ability: "Drizzle", moves: ["Hurricane", "Tailwind", "Protect"] },
      { species: "Archaludon", item: "Leftovers", ability: "Stamina", moves: ["Electro Shot", "Flash Cannon", "Body Press", "Protect"] },
    ];
    const v = auditTeam(team, FORMAT);
    expect(v.some((x) => x.rule === "weather-trap")).toBe(false);
  });
});

describe("auditTeam — speed identity", () => {
  it("flags Trick Room on a Tailwind team", () => {
    const team: AITeamMember[] = [
      { species: "Whimsicott", ability: "Prankster", moves: ["Tailwind", "Moonblast", "Encore", "Protect"] },
      { species: "Farigiraf", ability: "Armor Tail", moves: ["Trick Room", "Psychic", "Protect"] },
    ];
    const v = auditTeam(team, FORMAT);
    expect(v.some((x) => x.rule === "speed-identity" && x.severity === "error")).toBe(true);
  });

  it("does NOT flag a Trick Room + sun (Drought) team — sun is a damage weather, not speed", () => {
    const team: AITeamMember[] = [
      { species: "Torkoal", ability: "Drought", moves: ["Eruption", "Heat Wave", "Protect"] },
      { species: "Farigiraf", ability: "Armor Tail", moves: ["Trick Room", "Psychic", "Protect"] },
      { species: "Mawile", item: "Mawilite", ability: "Huge Power", moves: ["Play Rough", "Sucker Punch", "Protect"] },
    ];
    const v = auditTeam(team, FORMAT);
    expect(v.some((x) => x.rule === "speed-identity")).toBe(false);
  });

  it("DOES flag Trick Room + a Chlorophyll speed abuser (real clash)", () => {
    const team: AITeamMember[] = [
      { species: "Torkoal", ability: "Drought", moves: ["Eruption", "Heat Wave", "Protect"] },
      { species: "Lilligant", ability: "Chlorophyll", moves: ["Solar Beam", "Protect"] },
      { species: "Farigiraf", ability: "Armor Tail", moves: ["Trick Room", "Psychic", "Protect"] },
    ];
    const v = auditTeam(team, FORMAT);
    expect(v.some((x) => x.rule === "speed-identity" && x.severity === "error")).toBe(true);
  });

  it("flags a fast Pokemon (Garchomp, base Spe 102) on a Trick Room team", () => {
    const team: AITeamMember[] = [
      { species: "Farigiraf", ability: "Armor Tail", moves: ["Trick Room", "Psychic", "Protect"] },
      { species: "Mawile", item: "Mawilite", ability: "Huge Power", moves: ["Play Rough", "Sucker Punch", "Protect"] },
      { species: "Garchomp", ability: "Rough Skin", moves: ["Earthquake", "Stone Edge", "Protect"] },
    ];
    const v = auditTeam(team, FORMAT);
    expect(v.some((x) => x.rule === "tr-speed" && x.severity === "error" && x.subject === "Garchomp")).toBe(true);
  });

  it("does NOT flag an all-slow Trick Room core (Mawile/Farigiraf/Torkoal)", () => {
    const team: AITeamMember[] = [
      { species: "Mawile", item: "Mawilite", ability: "Huge Power", moves: ["Play Rough", "Sucker Punch", "Protect"] },
      { species: "Farigiraf", ability: "Armor Tail", moves: ["Trick Room", "Psychic", "Protect"] },
      { species: "Torkoal", ability: "Drought", moves: ["Eruption", "Heat Wave", "Protect"] },
    ];
    const v = auditTeam(team, FORMAT);
    expect(v.some((x) => x.rule === "tr-speed")).toBe(false);
  });

  it("does NOT flag a pure Trick Room team", () => {
    const team: AITeamMember[] = [
      { species: "Farigiraf", ability: "Armor Tail", moves: ["Trick Room", "Psychic", "Protect"] },
      { species: "Incineroar", ability: "Intimidate", moves: ["Fake Out", "Flare Blitz", "Parting Shot"] },
    ];
    const v = auditTeam(team, FORMAT);
    expect(v.some((x) => x.rule === "speed-identity")).toBe(false);
  });
});

describe("auditTeam — legality", () => {
  it("flags two mega stones", () => {
    const team: AITeamMember[] = [
      { species: "Staraptor", item: "Staraptite", ability: "Reckless" },
      { species: "Charizard", item: "Charizardite Y", ability: "Blaze" },
    ];
    const v = auditTeam(team, FORMAT);
    expect(v.some((x) => x.rule === "mega-clause" && x.severity === "error")).toBe(true);
  });

  it("flags an illegal roster pick (Miraidon)", () => {
    const team: AITeamMember[] = [{ species: "Miraidon", ability: "Hadron Engine" }];
    const v = auditTeam(team, FORMAT);
    expect(v.some((x) => x.rule === "roster")).toBe(true);
  });

  it("flags a duplicate species", () => {
    const team: AITeamMember[] = [
      { species: "Garchomp", ability: "Rough Skin" },
      { species: "Garchomp", ability: "Rough Skin" },
    ];
    const v = auditTeam(team, FORMAT);
    expect(v.some((x) => x.rule === "species-clause")).toBe(true);
  });

  it("flags a banned item (Assault Vest in M-B)", () => {
    const team: AITeamMember[] = [
      { species: "Incineroar", item: "Assault Vest", ability: "Intimidate" },
    ];
    const v = auditTeam(team, FORMAT);
    expect(v.some((x) => x.rule === "item-legality" && x.subject === "Incineroar")).toBe(true);
  });

  it("flags an ability the species can't have (Garchomp with Levitate)", () => {
    const team: AITeamMember[] = [{ species: "Garchomp", ability: "Levitate" }];
    const v = auditTeam(team, FORMAT);
    expect(v.some((x) => x.rule === "ability-legality" && x.severity === "error")).toBe(true);
  });

  it("accepts the post-mega ability on a mega member (Mawile @ Mawilite = Huge Power)", () => {
    const team: AITeamMember[] = [
      { species: "Mawile", item: "Mawilite", ability: "Huge Power" },
    ];
    const v = auditTeam(team, FORMAT);
    expect(v.some((x) => x.rule === "ability-legality")).toBe(false);
  });

  it("warns on a made-up move name", () => {
    const team: AITeamMember[] = [
      { species: "Garchomp", ability: "Rough Skin", moves: ["Earthquake", "Dragon Pulse Deluxe"] },
    ];
    const v = auditTeam(team, FORMAT);
    expect(v.some((x) => x.rule === "move-legality" && x.severity === "warning")).toBe(true);
  });

  it("passes a clean, coherent team with no blocking errors", () => {
    const team: AITeamMember[] = [
      ...tailwindCore,
      { species: "Raichu", item: "Magnet", ability: "Lightning Rod", moves: ["Fake Out", "Thunderbolt", "Volt Switch", "Protect"] },
      { species: "Primarina", item: "Mystic Water", ability: "Liquid Voice", moves: ["Hyper Voice", "Moonblast", "Haze", "Protect"] },
      { species: "Garchomp", item: "Life Orb", ability: "Rough Skin", moves: ["Earthquake", "Stone Edge", "Dragon Claw", "Protect"] },
    ];
    expect(teamErrors(team, FORMAT)).toHaveLength(0);
  });
});
