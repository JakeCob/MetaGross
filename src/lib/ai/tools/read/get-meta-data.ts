import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getMetaThreats, getMetaSpreads } from "@/lib/ev/meta-lookup";
import {
  CHAMPIONS_POKEMON,
  CHAMPIONS_ITEMS,
  isChampionsPokemon,
} from "@/lib/data/champions";

export const getMetaDataTool = new DynamicStructuredTool({
  name: "get_meta_data",
  description:
    "Get meta game data for Pokemon Champions Reg M-A. Can return: top threats with usage % and common sets, common spreads for a species, list of available Pokemon, or list of available items. ALWAYS use this before recommending Pokemon, items, or moves to verify they exist in Champions.",
  schema: z.object({
    query: z
      .enum(["threats", "spreads", "available_pokemon", "available_items", "check_pokemon"])
      .describe("What to look up: threats, spreads, available_pokemon, available_items, or check_pokemon"),
    species: z
      .string()
      .optional()
      .describe("Species name — required for 'spreads' and 'check_pokemon' queries"),
    format: z
      .string()
      .optional()
      .default("champions-reg-m-a")
      .describe("Format to look up"),
  }),
  func: async ({ query, species }) => {
    if (query === "available_pokemon") {
      return JSON.stringify({
        format: "Champions Reg M-A",
        totalAvailable: CHAMPIONS_POKEMON.length,
        pokemon: CHAMPIONS_POKEMON,
        note: "This list includes Pokemon confirmed in competitive play. More may be available.",
      });
    }

    if (query === "available_items") {
      return JSON.stringify({
        format: "Champions Reg M-A",
        totalAvailable: CHAMPIONS_ITEMS.length,
        items: CHAMPIONS_ITEMS,
        note: "Includes Mega Stones. This list is from competitive usage data.",
      });
    }

    if (query === "check_pokemon") {
      if (!species) {
        return JSON.stringify({ error: "species is required for check_pokemon" });
      }
      return JSON.stringify({
        species,
        availableInChampions: isChampionsPokemon(species),
        note: isChampionsPokemon(species)
          ? `${species} is confirmed available in Champions Reg M-A.`
          : `${species} is NOT confirmed in Champions Reg M-A. Do not recommend it.`,
      });
    }

    if (query === "threats") {
      const threats = getMetaThreats();
      return JSON.stringify(
        threats.map((t) => ({
          species: t.species,
          usagePercent: t.usagePercent,
          availableInChampions: isChampionsPokemon(t.species),
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
      return JSON.stringify({
        error: "species is required when query is 'spreads'",
      });
    }

    const spreads = getMetaSpreads(species);
    if (spreads.length === 0) {
      return JSON.stringify({
        error: `No meta spreads found for ${species}`,
      });
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
