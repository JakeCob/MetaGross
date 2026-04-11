import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { optimizeEVSpread } from "@/lib/ai/ev-debate";
import { DEFAULT_EVS, DEFAULT_IVS } from "@/lib/types/pokemon";
import type { TeamPokemon } from "@/lib/types/pokemon";

export const optimizeEVSpreadTool = new DynamicStructuredTool({
  name: "optimize_ev_spread",
  description:
    "Run the multi-agent EV spread optimizer for a Pokemon. Uses the Wolfe Glick and CybertronVGC personas to debate the spread, then simulates against meta threats. Returns the optimized Champions Stat Points (66 total, 32 max/stat) with reasoning from both experts. Call this for EVERY Pokemon when building a team to get proper spreads.",
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

      const result = await optimizeEVSpread(pokemon, team, "champions-reg-m-a");

      return JSON.stringify({
        species,
        optimizedSpread: result.spread,
        nature: result.nature,
        reasoning: result.reasoning,
        wolfeComment: result.wolfeComment,
        cybertronComment: result.cybertronComment,
        benchmarks: result.benchmarks.slice(0, 5),
        iterations: result.iterations,
        note: "These are Champions Stat Points (66 total, 32 max/stat). Use these values directly in the Points field.",
      });
    } catch (error) {
      return JSON.stringify({
        error: `EV optimization failed for ${species}: ${(error as Error).message}`,
        fallback: "Use a balanced spread like HP 22 / primary_stat 32 / secondary_stat 12 = 66",
      });
    }
  },
});
