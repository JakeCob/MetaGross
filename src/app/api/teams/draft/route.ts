import { z } from "zod";
import { db } from "@/lib/db";
import { teams, teamPokemon } from "@/lib/db/schema";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

export const runtime = "nodejs";

const DraftSchema = z.object({
  name: z.string().min(1).max(120),
  archetype: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  species: z.array(z.string().min(1)).min(1).max(6),
});

const BodySchema = z.object({
  drafts: z.array(DraftSchema).min(1).max(10),
  format: z.string().optional(),
  userId: z.string().optional(),
});

/**
 * POST /api/teams/draft
 *
 * Bulk-saves research teams as draft entries (isDraft=1). The
 * TeamBuilderWithAgent's "Use first, save rest as drafts" flow calls
 * this with the tail of the ResearchTeamBlock[] list.
 *
 * Each draft row gets:
 *   - isDraft=1, isActive=0
 *   - archetype/description/sourceUrl fields populated when supplied
 *   - team_pokemon rows with species only (no ability/item/moves — the
 *     user will flesh those out when reviewing the draft)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid body", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const format = parsed.data.format ?? ACTIVE_REGULATION_FORMAT_ID;
    const userId = parsed.data.userId ?? "00000000-0000-0000-0000-000000000001";
    const now = Date.now();
    const insertedIds: string[] = [];

    for (const draft of parsed.data.drafts) {
      const inserted = await db
        .insert(teams)
        .values({
          userId,
          name: draft.name,
          format,
          isActive: 0,
          isDraft: 1,
          archetype: draft.archetype ?? null,
          description: draft.description ?? null,
          sourceUrl: draft.sourceUrl ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: teams.id })
        .all();

      const teamRow = inserted[0];
      if (!teamRow) continue;
      insertedIds.push(teamRow.id);

      for (let i = 0; i < draft.species.length; i++) {
        await db
          .insert(teamPokemon)
          .values({
            teamId: teamRow.id,
            slot: i + 1,
            species: draft.species[i],
            ability: "",
            item: null,
            nature: "Hardy",
            level: 50,
            createdAt: now,
          })
          .run();
      }
    }

    return Response.json(
      { insertedIds, count: insertedIds.length },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/teams/draft error:", err);
    return Response.json(
      { error: "Failed to save draft teams" },
      { status: 500 },
    );
  }
}
