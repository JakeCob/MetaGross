import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { calculateBenchmarks } from "@/lib/ev/benchmark";
import { getMetaThreats } from "@/lib/ev/meta-lookup";
import type { TeamPokemon } from "@/lib/types/pokemon";

const evSpreadSchema = z.object({
  hp: z.number().int().min(0).max(252),
  atk: z.number().int().min(0).max(252),
  def: z.number().int().min(0).max(252),
  spa: z.number().int().min(0).max(252),
  spd: z.number().int().min(0).max(252),
  spe: z.number().int().min(0).max(252),
});

const ivSpreadSchema = z.object({
  hp: z.number().int().min(0).max(31),
  atk: z.number().int().min(0).max(31),
  def: z.number().int().min(0).max(31),
  spa: z.number().int().min(0).max(31),
  spd: z.number().int().min(0).max(31),
  spe: z.number().int().min(0).max(31),
});

export const getEvBenchmarksTool = new DynamicStructuredTool({
  name: "get_ev_benchmarks",
  description:
    "Calculate EV benchmarks for a Pokemon against top meta threats. Returns survival, KO, and speed benchmarks plus a suggested EV spread.",
  schema: z.object({
    pokemon: z
      .object({
        species: z.string(),
        ability: z.string(),
        item: z.string(),
        nature: z.string(),
        level: z.number().int().default(50),
        moves: z.array(z.string()).length(4),
        evs: evSpreadSchema,
        ivs: ivSpreadSchema,
      })
      .describe("The Pokemon to benchmark"),
    format: z.string().optional().default("champions-reg-m-a"),
  }),
  func: async ({ pokemon, format }) => {
    const threats = getMetaThreats(format);
    const report = calculateBenchmarks(pokemon as TeamPokemon, threats);

    return JSON.stringify({
      pokemon: report.pokemon,
      suggestedSpread: report.suggestedSpread,
      suggestedNature: report.suggestedNature,
      survivalBenchmarks: report.survivalBenchmarks.slice(0, 10),
      koBenchmarks: report.koBenchmarks.slice(0, 10),
      speedBenchmarks: report.speedBenchmarks.slice(0, 10),
    });
  },
});
