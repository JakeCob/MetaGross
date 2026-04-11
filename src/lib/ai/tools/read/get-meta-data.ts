import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getMetaThreats, getMetaSpreads } from "@/lib/ev/meta-lookup";

export const getMetaDataTool = new DynamicStructuredTool({
  name: "get_meta_data",
  description:
    "Get meta game data: either the top threats in the format (with usage % and common sets), or the common EV spreads for a specific species.",
  schema: z.object({
    query: z.enum(["threats", "spreads"]).describe("Whether to get top threats or spreads for a species"),
    species: z
      .string()
      .optional()
      .describe("Species name — required when query is 'spreads'"),
    format: z.string().optional().default("champions-reg-m-a").describe("Format to look up"),
  }),
  func: async ({ query, species, format }) => {
    if (query === "threats") {
      const threats = getMetaThreats(format);
      return JSON.stringify(
        threats.map((t) => ({
          species: t.species,
          usagePercent: t.usagePercent,
          commonSets: t.commonSets.map((s) => ({
            nature: s.nature,
            ability: s.ability,
            item: s.item,
            moves: s.moves,
            evs: s.evs,
          })),
        })),
      );
    }

    if (!species) {
      return JSON.stringify({ error: "species is required when query is 'spreads'" });
    }

    const spreads = getMetaSpreads(species, format);
    if (spreads.length === 0) {
      return JSON.stringify({ error: `No meta spreads found for ${species}` });
    }

    return JSON.stringify(
      spreads.map((s) => ({
        nature: s.nature,
        evs: s.evs,
        usagePercent: s.usagePercent,
        rank: s.rank,
      })),
    );
  },
});
