import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getTeamById } from "@/lib/db/queries/teams";

export const getTeamTool = new DynamicStructuredTool({
  name: "get_team",
  description:
    "Load a saved team by ID, including all Pokemon with their sets (species, ability, item, nature, EVs, IVs, moves).",
  schema: z.object({
    teamId: z.string().describe("The team UUID to look up"),
  }),
  func: async ({ teamId }) => {
    const team = getTeamById(teamId);

    if (!team) {
      return JSON.stringify({ error: `Team not found: ${teamId}` });
    }

    return JSON.stringify({
      id: team.id,
      name: team.name,
      format: team.format,
      notes: team.notes,
      pokemon: team.pokemon.map((p) => ({
        species: p.species,
        ability: p.ability,
        item: p.item,
        nature: p.nature,
        level: p.level,
        teraType: p.teraType,
        megaEvolution: p.megaEvolution,
        moves: p.moves,
        evs: p.evs,
        ivs: p.ivs,
      })),
    });
  },
});
