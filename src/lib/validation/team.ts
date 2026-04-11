import { z } from "zod";

// Accept 0-252 per stat to cover both traditional EVs (max 252) and Champions points (max 32).
// The UI enforces the tighter per-format limits; validation is permissive to support both systems.
const evStatSchema = z.number().int().min(0).max(252);
const ivStatSchema = z.number().int().min(0).max(31);

const evSpreadSchema = z
  .object({
    hp: evStatSchema,
    atk: evStatSchema,
    def: evStatSchema,
    spa: evStatSchema,
    spd: evStatSchema,
    spe: evStatSchema,
  })
  .check((ctx) => {
    const evs = ctx.value;
    const total = evs.hp + evs.atk + evs.def + evs.spa + evs.spd + evs.spe;
    // Accept up to 510 to cover both traditional (510) and Champions (66) formats.
    if (total > 510) {
      ctx.issues.push({
        message: "Total EVs/Points cannot exceed the format maximum",
        code: "custom",
        input: evs,
        path: [],
      });
    }
  });

const ivSpreadSchema = z.object({
  hp: ivStatSchema,
  atk: ivStatSchema,
  def: ivStatSchema,
  spa: ivStatSchema,
  spd: ivStatSchema,
  spe: ivStatSchema,
});

export const teamPokemonSchema = z.object({
  species: z.string().min(1, "Species is required"),
  ability: z.string().min(1, "Ability is required"),
  item: z.string(),
  nature: z.string().min(1, "Nature is required"),
  level: z.number().int().min(1).max(100),
  teraType: z.string().optional(),
  megaEvolution: z.string().optional(),
  moves: z
    .array(z.string().min(1))
    .min(1, "At least 1 move required")
    .max(4, "Maximum 4 moves"),
  evs: evSpreadSchema,
  ivs: ivSpreadSchema,
});

export const teamSchema = z
  .object({
    name: z.string().min(1, "Team name is required"),
    format: z.string().min(1),
    pokemon: z
      .array(teamPokemonSchema)
      .min(1, "At least 1 Pokemon required")
      .max(6, "Maximum 6 Pokemon"),
  })
  .check((ctx) => {
    const team = ctx.value;
    // Species Clause
    const species = team.pokemon.map((p) => p.species.toLowerCase());
    if (new Set(species).size !== species.length) {
      ctx.issues.push({
        message: "Duplicate species not allowed (Species Clause)",
        code: "custom",
        input: team,
        path: ["pokemon"],
      });
    }
    // Item Clause
    const items = team.pokemon
      .map((p) => p.item?.toLowerCase())
      .filter(Boolean);
    if (new Set(items).size !== items.length) {
      ctx.issues.push({
        message: "Duplicate items not allowed (Item Clause)",
        code: "custom",
        input: team,
        path: ["pokemon"],
      });
    }
  });

export type TeamInput = z.input<typeof teamSchema>;
export type TeamPokemonInput = z.input<typeof teamPokemonSchema>;

export function validateTeam(data: unknown):
  | { success: true; data: TeamInput }
  | { success: false; errors: string[] } {
  const result = teamSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map((issue) => issue.message);
  return { success: false, errors };
}
