import { z } from "zod";
import { upsertMetaTeam } from "@/lib/meta-teams/queries";

export const runtime = "nodejs";

const MetaTeamPokemonSchema = z.object({
  species: z.string().min(1),
  ability: z.string().optional(),
  item: z.string().optional(),
  nature: z.string().optional(),
  moves: z.array(z.string()).optional(),
  teraType: z.string().optional(),
});

const SubmitSchema = z.object({
  species: z.array(z.string().min(1)).min(3).max(6),
  pokemon: z.array(MetaTeamPokemonSchema).optional(),
  author: z.string().optional(),
  record: z.string().optional(),
  archetype: z.string().optional(),
  description: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  format: z.string().optional(),
});

/**
 * POST /api/meta-teams/submit
 *
 * Accepts a user-contributed meta team. Source is always "user"; trust
 * defaults to 0.5. Fingerprint-based dedupe means re-submitting the
 * same 6 Pokemon just updates the row with any new notes.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parse = SubmitSchema.safeParse(body);
    if (!parse.success) {
      return Response.json(
        { error: "Invalid submission", issues: parse.error.issues },
        { status: 400 },
      );
    }
    const input = parse.data;

    const team = await upsertMetaTeam({
      source: "user",
      sourceRef: input.author ? `user::${input.author}::${Date.now()}` : null,
      sourceUrl: input.sourceUrl ?? null,
      format: input.format ?? "champions-reg-m-a",
      author: input.author ?? null,
      record: input.record ?? null,
      archetype: input.archetype ?? null,
      description: input.description ?? null,
      species: input.species,
      pokemon: input.pokemon ?? [],
      trust: 0.5,
      seenAt: Date.now(),
    });

    return Response.json({ team }, { status: 201 });
  } catch (err) {
    console.error("POST /api/meta-teams/submit error:", err);
    return Response.json(
      { error: "Failed to submit meta team" },
      { status: 500 },
    );
  }
}
