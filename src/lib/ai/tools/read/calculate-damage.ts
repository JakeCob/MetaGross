import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { calculateDamage } from "@/lib/engine/damage-calc";
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

const pokemonSchema = z.object({
  species: z.string(),
  ability: z.string(),
  item: z.string(),
  nature: z.string(),
  level: z.number().int().default(50),
  moves: z.array(z.string()).length(4),
  evs: evSpreadSchema,
  ivs: ivSpreadSchema,
});

export const calculateDamageTool = new DynamicStructuredTool({
  name: "calculate_damage",
  description:
    "Calculate damage dealt by one Pokemon's move against another. Returns min/max damage percentages, KO chances, and a descriptive string.",
  schema: z.object({
    attacker: pokemonSchema.describe("The attacking Pokemon"),
    defender: pokemonSchema.describe("The defending Pokemon"),
    moveName: z.string().describe("Name of the move being used"),
    options: z
      .object({
        weather: z.enum(["rain", "sun", "sand", "snow"]).nullable().optional(),
        terrain: z.enum(["electric", "grassy", "misty", "psychic"]).nullable().optional(),
        isDoubles: z.boolean().optional().default(true),
      })
      .optional(),
  }),
  func: async ({ attacker, defender, moveName, options }) => {
    const result = calculateDamage(
      attacker as TeamPokemon,
      defender as TeamPokemon,
      moveName,
      {
        weather: options?.weather ?? undefined,
        terrain: options?.terrain ?? undefined,
        isDoubles: options?.isDoubles ?? true,
      },
    );

    if (!result) {
      return JSON.stringify({ error: "Could not calculate damage. Check species/move names." });
    }

    return JSON.stringify({
      minPercent: result.minPercent,
      maxPercent: result.maxPercent,
      koChance: result.koChance,
      description: result.description,
    });
  },
});
