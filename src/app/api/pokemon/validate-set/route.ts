import { z } from "zod";
import { validateSet } from "@/lib/pokemon/validate-set";

export const runtime = "nodejs";

const BodySchema = z.object({
  species: z.string().min(1),
  ability: z.string().optional(),
  moves: z.array(z.string()).max(8).optional(),
  format: z.string().optional(),
});

/**
 * POST /api/pokemon/validate-set
 *
 * Body: { species, ability?, moves? }
 *
 * Returns { resolvedSpecies, speciesAbilities, warnings[] }.
 *
 * Used client-side to catch LLM hallucinations (wrong ability on a
 * species, made-up moves, bad Mega name) and surface a ⚠ on the
 * rendered Pokemon card.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parse = BodySchema.safeParse(body);
    if (!parse.success) {
      return Response.json(
        { error: "Invalid body", issues: parse.error.issues },
        { status: 400 },
      );
    }
    const result = validateSet(parse.data);
    return Response.json(result, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    });
  } catch (err) {
    console.error("POST /api/pokemon/validate-set error:", err);
    return Response.json(
      { error: "Validation failed" },
      { status: 500 },
    );
  }
}
