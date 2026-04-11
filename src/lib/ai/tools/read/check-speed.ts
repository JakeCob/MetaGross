import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getEffectiveSpeed, compareSpeed } from "@/lib/engine/speed-calc";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { FieldState } from "@/lib/types/battle";
import { DEFAULT_FIELD_STATE } from "@/lib/types/battle";

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

const fieldSchema = z
  .object({
    weather: z.enum(["rain", "sun", "sand", "snow"]).nullable().optional(),
    terrain: z.enum(["electric", "grassy", "misty", "psychic"]).nullable().optional(),
    trickRoom: z.boolean().optional(),
    tailwindP1: z.boolean().optional(),
    tailwindP2: z.boolean().optional(),
  })
  .optional();

export const checkSpeedTool = new DynamicStructuredTool({
  name: "check_speed",
  description:
    "Compare speed of two Pokemon, accounting for items, abilities, weather, Tailwind, and Trick Room. Returns effective speeds and who moves first.",
  schema: z.object({
    pokemonA: pokemonSchema.describe("First Pokemon"),
    pokemonB: pokemonSchema.describe("Second Pokemon"),
    field: fieldSchema.describe("Field conditions (weather, terrain, trick room, tailwind)"),
    aStatus: z.string().nullable().optional().describe("Status condition on Pokemon A (paralysis, etc)"),
    bStatus: z.string().nullable().optional().describe("Status condition on Pokemon B"),
  }),
  func: async ({ pokemonA, pokemonB, field, aStatus, bStatus }) => {
    const fieldState: FieldState = {
      ...DEFAULT_FIELD_STATE,
      weather: (field?.weather as FieldState["weather"]) ?? null,
      terrain: (field?.terrain as FieldState["terrain"]) ?? null,
      trickRoom: field?.trickRoom ?? false,
      tailwindP1: field?.tailwindP1 ?? false,
      tailwindP2: field?.tailwindP2 ?? false,
    };

    const speedA = getEffectiveSpeed(
      pokemonA as TeamPokemon,
      fieldState,
      aStatus ?? null,
      "p1",
    );
    const speedB = getEffectiveSpeed(
      pokemonB as TeamPokemon,
      fieldState,
      bStatus ?? null,
      "p2",
    );

    const result = compareSpeed(
      pokemonA as TeamPokemon,
      pokemonB as TeamPokemon,
      fieldState,
      "p1",
      "p2",
      aStatus ?? null,
      bStatus ?? null,
    );

    return JSON.stringify({
      speedA,
      speedB,
      faster: result,
      trickRoom: fieldState.trickRoom,
      summary:
        result === "tie"
          ? `Speed tie at ${speedA} — random who moves first`
          : `${result === "a" ? pokemonA.species : pokemonB.species} moves first (${Math.max(speedA, speedB)} vs ${Math.min(speedA, speedB)})${fieldState.trickRoom ? " [Trick Room active]" : ""}`,
    });
  },
});
