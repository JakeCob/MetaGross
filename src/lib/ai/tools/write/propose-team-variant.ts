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

const ivSpreadSchema = z.object({
  hp: z.number().int().min(0).max(31),
  atk: z.number().int().min(0).max(31),
  def: z.number().int().min(0).max(31),
  spa: z.number().int().min(0).max(31),
  spd: z.number().int().min(0).max(31),
  spe: z.number().int().min(0).max(31),
});

const pokemonSchema = z.object({
  species: z.string(),
  ability: z.string(),
  item: z.string(),
  nature: z.string(),
  level: z.number().int().default(50),
  moves: z.array(z.string()).length(4),
  evs: evSpreadSchema,
  ivs: ivSpreadSchema,
  teraType: z.string().optional(),
  megaEvolution: z.string().optional(),
});

export const proposeTeamVariantTool = new DynamicStructuredTool({
  name: "propose_team_variant",
  description:
    "Propose creating a new team variant (a copy with modifications). This does NOT execute the write — it returns a proposal for the user to approve, reject, or edit.",
  schema: z.object({
    baseTeamId: z.string().describe("The source team ID to base the variant on"),
    variantName: z.string().describe("Name for the new team variant"),
    pokemon: z
      .array(pokemonSchema)
      .min(1)
      .max(6)
      .describe("The full Pokemon roster for the variant"),
    reason: z.string().describe("Why this team variant is being suggested"),
  }),
  func: async ({ baseTeamId, variantName, pokemon, reason }) => {
    const proposal: WriteActionProposal = {
      actionType: "create_team_variant",
      description: reason,
      payload: { baseTeamId, variantName, pokemon },
    };

    return JSON.stringify(proposal);
  },
});
