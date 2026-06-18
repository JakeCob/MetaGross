import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { exportPokepasteTool } from "../read/export-pokepaste";

async function run(input: Parameters<typeof exportPokepasteTool.invoke>[0]) {
  const raw = await exportPokepasteTool.invoke(input);
  return JSON.parse(raw as string) as {
    pokepaste: string;
    teamSize: number;
    format: string;
    nextStep: string;
  };
}

describe("export_pokepaste", () => {
  it("converts Champions points to EVs (×8, capped at 252)", async () => {
    const out = await run({
      pokemon: [
        {
          species: "Scovillain",
          ability: "Spicy Spray",
          item: "Scovillainite",
          nature: "Calm",
          moves: ["Overheat", "Leech Seed", "Rage Powder", "Protect"],
          points: { hp: 32, atk: 0, def: 24, spa: 0, spd: 10, spe: 0 },
        },
      ],
    });
    // 32 × 8 = 256 → capped at 252
    expect(out.pokepaste).toMatch(/EVs:.*252 HP/);
    // 24 × 8 = 192
    expect(out.pokepaste).toMatch(/192 Def/);
    // 10 × 8 = 80
    expect(out.pokepaste).toMatch(/80 SpD/);
    // Zero stats should NOT appear.
    expect(out.pokepaste).not.toMatch(/0 Atk/);
    // Species @ Item header
    expect(out.pokepaste).toMatch(/^Scovillain @ Scovillainite/m);
    // Nature line uses Showdown convention
    expect(out.pokepaste).toMatch(/Calm Nature/);
    // Moves emitted as "- Move"
    expect(out.pokepaste).toMatch(/- Overheat/);
  });

  it("emits multi-Pokemon teams separated by blank lines", async () => {
    const out = await run({
      teamName: "Wolfe — Burn Wall",
      pokemon: [
        {
          species: "Scovillain",
          ability: "Spicy Spray",
          item: "Scovillainite",
          moves: ["Overheat"],
          points: { hp: 32 },
        },
        {
          species: "Primarina",
          ability: "Liquid Voice",
          item: "Leftovers",
          moves: ["Hyper Voice"],
          points: { hp: 30, spa: 32 },
        },
      ],
    });
    expect(out.teamSize).toBe(2);
    // No explicit format passed → defaults to the active regulation label (M-B).
    expect(out.pokepaste).toMatch(/=== \[Champions Reg M-B\] Wolfe — Burn Wall ===/);
    // Blocks separated by exactly one blank line
    expect(out.pokepaste.split(/\n\n/).length).toBeGreaterThanOrEqual(3);
  });

  it("omits IV line when all IVs are 31 (the Champions default)", async () => {
    const out = await run({
      pokemon: [
        {
          species: "Conkeldurr",
          ability: "Iron Fist",
          item: "Sitrus Berry",
          ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
          moves: ["Drain Punch"],
        },
      ],
    });
    expect(out.pokepaste).not.toMatch(/IVs:/);
  });

  it("emits an IV line only for off-default stats (e.g. 0 Spe for Trick Room)", async () => {
    const out = await run({
      pokemon: [
        {
          species: "Conkeldurr",
          ability: "Iron Fist",
          item: "Sitrus Berry",
          ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 0 },
          moves: ["Drain Punch"],
        },
      ],
    });
    expect(out.pokepaste).toMatch(/IVs:\s*0 Spe$/m);
  });
});
