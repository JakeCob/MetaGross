import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { WriteActionProposal } from "@/lib/types/agent";

const evSpreadSchema = z.object({
  hp: z.number().int().min(0).max(252),
  atk: z.number().int().min(0).max(252),
  def: z.number().int().min(0).max(252),
  spa: z.number().int().min(0).max(252),
  spd: z.number().int().min(0).max(252),
  spe: z.number().int().min(0).max(252),
});

export const proposePokemonPatchTool = new DynamicStructuredTool({
  name: "propose_pokemon_patch",
  description:
    "Propose patching a specific Pokemon's EVs, moves, item, or ability on an existing team. This does NOT execute the write — it returns a proposal for the user to approve, reject, or edit.",
  schema: z.object({
    teamId: z.string().describe("The team ID containing the Pokemon"),
    species: z.string().describe("The species of the Pokemon to patch"),
    patch: z
      .object({
        evs: evSpreadSchema.optional(),
        nature: z.string().optional(),
        moves: z.array(z.string()).length(4).optional(),
        item: z.string().optional(),
        ability: z.string().optional(),
        teraType: z.string().optional(),
      })
      .describe("The fields to update on the Pokemon"),
    reason: z.string().describe("Why this patch is being suggested"),
  }),
  func: async ({ teamId, species, patch, reason }) => {
    const proposal: WriteActionProposal = {
      actionType: "patch_team_pokemon",
      description: reason,
      payload: { teamId, species, patch },
    };

    return JSON.stringify(proposal);
  },
});
