import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { optimizeEVSpread } from "@/lib/ai/ev-debate";
import { DEFAULT_EVS, DEFAULT_IVS } from "@/lib/types/pokemon";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

export const optimizeEVSpreadTool = new DynamicStructuredTool({
  name: "optimize_ev_spread",
  description:
    "Run the multi-agent SET optimizer for a Pokemon. Flow: baseline simulator → Spread Specialist proposes a full set (Ability + Item + Moves + Nature + Points) → Wolfe Glick reviews → CybertronVGC reviews → post-debate simulator → Final Decision synthesizes. Returns the full optimized set with reasoning and before/after benchmark diffs. Call this for EVERY Pokemon. The returned Ability/Item/Moves may differ from your input — use the returned values, not the input.",
  schema: z.object({
    species: z.string().describe("Pokemon species name"),
    role: z.string().describe("Role on the team (e.g., Rain Setter, Physical Sweeper, Intimidate Pivot)"),
    ability: z.string().describe("The Pokemon's ability"),
    item: z.string().describe("The Pokemon's held item"),
    nature: z.string().describe("The Pokemon's nature"),
    moves: z.array(z.string()).describe("The Pokemon's 4 moves"),
    teammateSpecies: z.array(z.string()).optional().describe("Species names of the other 5 teammates"),
  }),
  func: async ({ species, role, ability, item, nature, moves, teammateSpecies }) => {
    try {
      const pokemon: TeamPokemon = {
        species,
        ability,
        item,
        nature,
        level: 50,
        moves: [moves[0] || "", moves[1] || "", moves[2] || "", moves[3] || ""],
        evs: { ...DEFAULT_EVS },
        ivs: { ...DEFAULT_IVS },
      };

      const team: TeamPokemon[] = (teammateSpecies || []).map((s) => ({
        species: s,
        ability: "",
        item: "",
        nature: "Hardy",
        level: 50,
        moves: ["", "", "", ""],
        evs: { ...DEFAULT_EVS },
        ivs: { ...DEFAULT_IVS },
      }));

      const result = await optimizeEVSpread(pokemon, team, ACTIVE_REGULATION_FORMAT_ID);

      return JSON.stringify({
        species,
        optimizedSet: {
          ability: result.ability,
          item: result.item,
          moves: result.moves,
          nature: result.nature,
          spread: result.spread,
        },
        // Kept for backwards compatibility with any caller that still reads
        // these top-level fields:
        optimizedSpread: result.spread,
        nature: result.nature,
        ability: result.ability,
        item: result.item,
        moves: result.moves,
        reasoning: result.reasoning,
        wolfeComment: result.wolfeComment,
        cybertronComment: result.cybertronComment,
        initialBenchmarks: result.initialBenchmarks.slice(0, 5),
        benchmarks: result.benchmarks.slice(0, 5),
        iterations: result.iterations,
        note: "Spread is Champions Stat Points (66 total, 32 max/stat). Use the full optimizedSet — Ability/Item/Moves/Nature may have been changed by the debate based on teammate synergy and benchmark results.",
      });
    } catch (error) {
      return JSON.stringify({
        error: `EV optimization failed for ${species}: ${(error as Error).message}`,
        fallback: "Use a balanced spread like HP 22 / primary_stat 32 / secondary_stat 12 = 66",
      });
    }
  },
});
