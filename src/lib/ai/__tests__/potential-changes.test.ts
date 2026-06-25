import { describe, it, expect, vi } from "vitest";
import { parseJsonResponse } from "../parse-json";

describe("parseJsonResponse", () => {
  it("parses a bare JSON object", () => {
    expect(parseJsonResponse<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });
  it("strips a ```json fence", () => {
    expect(parseJsonResponse<{ a: number }>('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it("extracts the outermost object when there's stray prose", () => {
    expect(parseJsonResponse<{ a: number }>('Sure!\n{"a":3}\nhope that helps')).toEqual({ a: 3 });
  });
  it("throws on truly malformed output", () => {
    expect(() => parseJsonResponse("not json at all")).toThrow();
  });
});

vi.mock("@/lib/ai/client", () => ({
  isAIAvailable: () => true,
  aiComplete: vi.fn(async () => ({
    text:
      '```json\n{"swaps":[' +
      '{"title":"Add Bronzong","reasoning":"Levitate + Trick Room","addMon":"Bronzong"},' +
      '{"title":"Add Incineroar support","reasoning":"Intimidate + Fake Out","addMon":"Incineroar"}],' +
      '"setTweaks":[{"species":"Garchomp","suggestion":"add AV","apply":{"item":"Assault Vest","nature":"Jolly","addMove":"Protect"}}],' +
      '"note":"Solid core; shore up the Fairy weakness."}\n```',
    inputTokens: 10,
    outputTokens: 20,
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
  })),
}));

import { generatePotentialChanges } from "../potential-changes";
import type { TeamPokemon } from "@/lib/types/pokemon";

const FLAT = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
function mon(species: string): TeamPokemon {
  return {
    species,
    ability: "",
    item: "",
    nature: "Hardy",
    level: 50,
    moves: ["", "", "", ""],
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { ...FLAT },
  };
}

describe("generatePotentialChanges", () => {
  it("parses the mocked AI response into typed swaps + setTweaks", async () => {
    const out = await generatePotentialChanges(
      [mon("Garchomp"), mon("Incineroar")],
      "Champions Reg M-B",
    );
    // Off-format swap (Bronzong) is dropped; the legal one (Incineroar) stays.
    expect(out.swaps).toHaveLength(1);
    expect(out.swaps[0]).toMatchObject({ title: "Add Incineroar support", addMon: "Incineroar" });
    // The banned item (Assault Vest) is stripped from apply; legal fields stay.
    expect(out.setTweaks[0]).toMatchObject({ species: "Garchomp" });
    expect(out.setTweaks[0].apply).toEqual({ addMove: "Protect", nature: "Jolly" });
    expect(out.note).toContain("Fairy");
  });
});
