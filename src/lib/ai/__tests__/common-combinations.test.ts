import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/ai/client", () => ({
  isAIAvailable: () => true,
  aiComplete: vi.fn(async () => ({
    text: JSON.stringify({
      combos: [
        {
          leads: ["Pelipper", "Archaludon"],
          back: ["Sneasler", "Kingambit"],
          strategy: "Drizzle + Electro Shot for an immediate Rain KO; Sneasler cleans late.",
        },
        // extra entries are capped at 4; a malformed one is dropped:
        { leads: ["Whimsicott"], strategy: "Tailwind turn 1." },
        { leads: ["X"] }, // no strategy → dropped
      ],
      note: "Not exhaustive — solid starting combos.",
    }),
    inputTokens: 10,
    outputTokens: 20,
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
  })),
}));

import { generateCommonCombinations } from "../common-combinations";
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

describe("generateCommonCombinations", () => {
  it("parses combos, drops malformed ones, and caps leads/back to 2", async () => {
    const out = await generateCommonCombinations(
      [mon("Pelipper"), mon("Archaludon"), mon("Sneasler")],
      "Champions Reg M-B",
    );
    expect(out.combos).toHaveLength(2); // the strategy-less entry is dropped
    expect(out.combos[0]).toMatchObject({
      leads: ["Pelipper", "Archaludon"],
      back: ["Sneasler", "Kingambit"],
    });
    expect(out.note).toContain("exhaustive");
  });
});
