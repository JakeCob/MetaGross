/**
 * Pipeline validator tests — guards against the regression classes we
 * keep seeing: banned items (Weakness Policy), illegal species
 * (Landorus-Therian), item-clause violations, Champions point overflows,
 * and Mega stone / base species mismatches.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { validateTeamBuildTool } from "../read/validate-team-build";

type RunInput = {
  species: string;
  item?: string;
  ability?: string;
  moves?: string[];
  points?: {
    hp?: number;
    atk?: number;
    def?: number;
    spa?: number;
    spd?: number;
    spe?: number;
  };
};

async function run(team: RunInput[]): Promise<{
  verdict: string;
  slots: Array<{ slot: number; verdict: string; issues: string[] }>;
  teamIssues: string[];
  summary: string;
  nextStep: string;
}> {
  const raw = await validateTeamBuildTool.invoke({ team });
  return JSON.parse(raw as string);
}

describe("validate_team_build — banned items", () => {
  it("rejects Aegislash + Weakness Policy", async () => {
    const out = await run([
      {
        species: "Aegislash",
        ability: "Stance Change",
        item: "Weakness Policy",
        moves: ["Shadow Ball", "Flash Cannon", "King's Shield", "Wide Guard"],
      },
    ]);
    expect(out.verdict).toBe("fix_needed");
    expect(out.slots[0].issues.join(" ")).toMatch(/Weakness Policy/i);
    expect(out.slots[0].issues.join(" ")).toMatch(/NOT in Pokemon Champions/i);
  });

  it("rejects Flame Orb on Conkeldurr", async () => {
    const out = await run([
      {
        species: "Conkeldurr",
        ability: "Guts",
        item: "Flame Orb",
        moves: ["Drain Punch", "Facade", "Mach Punch", "Protect"],
      },
    ]);
    expect(out.slots[0].issues.join(" ")).toMatch(/Flame Orb/i);
  });
});

describe("validate_team_build — illegal species", () => {
  it("rejects Landorus-Therian", async () => {
    const out = await run([
      {
        species: "Landorus-Therian",
        ability: "Intimidate",
        item: "Sitrus Berry",
        moves: ["Earthquake", "Rock Slide", "U-turn", "Protect"],
      },
    ]);
    expect(out.verdict).toBe("reject");
    expect(out.slots[0].verdict).toBe("reject");
    expect(out.slots[0].issues.join(" ")).toMatch(/Landorus|not.*Champions/i);
  });
});

describe("validate_team_build — item clause", () => {
  it("flags two Pokemon holding Leftovers", async () => {
    const out = await run([
      {
        species: "Incineroar",
        ability: "Intimidate",
        item: "Leftovers",
        moves: ["Fake Out", "Flare Blitz", "Knock Off", "Parting Shot"],
      },
      {
        species: "Garchomp",
        ability: "Rough Skin",
        item: "Leftovers",
        moves: ["Earthquake", "Dragon Claw", "Rock Slide", "Protect"],
      },
    ]);
    expect(out.teamIssues.join(" ")).toMatch(/Item Clause/i);
    expect(out.teamIssues.join(" ")).toMatch(/leftovers/i);
  });

  it("allows Leftovers on one Pokemon when others hold different items", async () => {
    const out = await run([
      {
        species: "Incineroar",
        ability: "Intimidate",
        item: "Leftovers",
        moves: ["Fake Out", "Flare Blitz", "Knock Off", "Parting Shot"],
      },
      {
        species: "Garchomp",
        ability: "Rough Skin",
        item: "Focus Sash",
        moves: ["Earthquake", "Dragon Claw", "Rock Slide", "Protect"],
      },
    ]);
    expect(
      out.teamIssues.filter((x) => /item clause/i.test(x)).length,
    ).toBe(0);
  });
});

describe("validate_team_build — Champions points overflow", () => {
  it("flags a slot where per-stat is ≤32 but total > 66", async () => {
    // Each stat is within the schema bounds, but the total (32+32+32 = 96)
    // breaks the Champions total cap. The schema accepts per-stat ≤32;
    // the tool's validatePoints catches the total overflow.
    const out = await run([
      {
        species: "Incineroar",
        ability: "Intimidate",
        item: "Sitrus Berry",
        moves: ["Fake Out"],
        points: { hp: 32, atk: 32, def: 32, spa: 0, spd: 0, spe: 0 },
      },
    ]);
    expect(out.slots[0].issues.join(" ")).toMatch(/total|66/i);
  });

  it("accepts a valid 66/32 spread", async () => {
    const out = await run([
      {
        species: "Incineroar",
        ability: "Intimidate",
        item: "Sitrus Berry",
        moves: ["Fake Out", "Flare Blitz", "Knock Off", "Parting Shot"],
        points: { hp: 32, atk: 2, def: 10, spa: 0, spd: 22, spe: 0 },
      },
    ]);
    const ptIssues = out.slots[0].issues.filter((i) =>
      /points/.test(i.toLowerCase()),
    );
    expect(ptIssues).toHaveLength(0);
  });
});

describe("validate_team_build — Mega stone match", () => {
  it("flags wrong Mega stone on a Mega species", async () => {
    const out = await run([
      {
        species: "Scovillain-Mega",
        ability: "Spicy Spray",
        item: "Charizardite Y",
        moves: ["Overheat", "Leech Seed", "Rage Powder", "Protect"],
      },
    ]);
    expect(out.slots[0].issues.join(" ")).toMatch(/Scovillainite/);
  });

  it("accepts matching Mega stone", async () => {
    const out = await run([
      {
        species: "Scovillain-Mega",
        ability: "Spicy Spray",
        item: "Scovillainite",
        moves: ["Overheat", "Leech Seed", "Rage Powder", "Protect"],
      },
    ]);
    const stoneIssue = out.slots[0].issues.find((i) =>
      /mega stone|scovillainite/i.test(i),
    );
    expect(stoneIssue).toBeUndefined();
  });
});

describe("validate_team_build — Champions movepool cuts", () => {
  it("flags Incineroar with Knock Off (cut from its Champions movepool)", async () => {
    const out = await run([
      {
        species: "Incineroar",
        ability: "Intimidate",
        item: "Sitrus Berry",
        moves: ["Fake Out", "Flare Blitz", "Knock Off", "Parting Shot"],
      },
    ]);
    expect(out.slots[0].issues.join(" ")).toMatch(/Knock Off/);
    expect(out.slots[0].issues.join(" ")).toMatch(/cannot use/i);
  });

  it("accepts Incineroar with in-movepool moves", async () => {
    const out = await run([
      {
        species: "Incineroar",
        ability: "Intimidate",
        item: "Sitrus Berry",
        moves: ["Fake Out", "Flare Blitz", "Darkest Lariat", "Parting Shot"],
      },
    ]);
    const moveIssue = out.slots[0].issues.find((i) =>
      /cannot use|movepool/i.test(i),
    );
    expect(moveIssue).toBeUndefined();
  });
});

describe("validate_team_build — overall verdict", () => {
  it("returns verdict=ok for a clean single-slot team", async () => {
    const out = await run([
      {
        species: "Incineroar",
        ability: "Intimidate",
        item: "Sitrus Berry",
        // Darkest Lariat replaces Knock Off — Champions cuts Knock Off
        // from Incineroar's movepool.
        moves: ["Fake Out", "Flare Blitz", "Darkest Lariat", "Parting Shot"],
      },
    ]);
    expect(out.verdict).toBe("ok");
    expect(out.slots[0].verdict).toBe("ok");
    expect(out.nextStep).toMatch(/simulate_vs_top_teams/);
  });
});
