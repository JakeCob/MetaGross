import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getSpecies } from "@/lib/pokemon/species";

export const lookupPokemonTool = new DynamicStructuredTool({
  name: "lookup_pokemon",
  description:
    "Look up a Pokemon species by name to get its types, base stats, and abilities.",
  schema: z.object({
    species: z.string().describe("Pokemon species name (e.g. 'Metagross', 'Incineroar', 'Gardevoir-Mega')"),
  }),
  func: async ({ species }) => {
    const data = getSpecies(species);

    if (!data) {
      return JSON.stringify({ error: `Species not found: ${species}` });
    }

    return JSON.stringify({
      name: data.name,
      types: data.types,
      baseStats: data.baseStats,
      abilities: data.abilities,
      bst: Object.values(data.baseStats).reduce((a, b) => a + b, 0),
    });
  },
});
