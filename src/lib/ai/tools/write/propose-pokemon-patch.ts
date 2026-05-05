import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { WriteActionProposal } from "@/lib/types/agent";
import type { PokemonPatchPayload } from "@/lib/ai/graph/team-patch";

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
    "Propose patching one slot on an existing team or live draft. Use this for direct edit requests like replacing one Pokemon, changing a move, adding Wide Guard, or updating an item/ability/nature. This does NOT execute the write — it returns a proposal for the user to approve, reject, or edit.",
  schema: z.object({
    teamId: z
      .string()
      .optional()
      .describe("The saved team ID, if one exists. Omit for an unsaved live draft."),
    species: z.string().describe("The CURRENT species of the Pokemon slot to patch"),
    slot: z
      .number()
      .int()
      .min(1)
      .max(6)
      .optional()
      .describe("Optional 1-based slot index. Use this when the user is clearly referring to a specific slot."),
    patch: z
      .object({
        species: z
          .string()
          .optional()
          .describe("Optional NEW species for this slot when replacing one Pokemon with another."),
        evs: evSpreadSchema.optional(),
        nature: z.string().optional(),
        moves: z.array(z.string()).length(4).optional(),
        item: z.string().optional(),
        ability: z.string().optional(),
        teraType: z.string().nullable().optional(),
        megaEvolution: z.string().nullable().optional(),
      })
      .describe("The fields to update on the target slot. Only include what the user explicitly asked to change."),
    reason: z.string().describe("Why this patch is being suggested"),
  }),
  func: async ({ teamId, species, slot, patch, reason }) => {
    const payload: PokemonPatchPayload = {
      ...(teamId ? { teamId } : {}),
      species,
      ...(typeof slot === "number" ? { slot } : {}),
      patch,
    };

    const proposal: WriteActionProposal = {
      actionType: "patch_team_pokemon",
      description: reason,
      payload,
    };

    return JSON.stringify(proposal);
  },
});
