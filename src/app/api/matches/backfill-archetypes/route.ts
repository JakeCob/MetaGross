import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  classifyArchetypeFromSnapshot,
  isKnownArchetype,
} from "@/lib/team-analysis/team-context";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

function archetypeOrNull(arche: string): string | null {
  return arche && arche !== "Unknown" ? arche : null;
}

/**
 * Backfill archetypeSelf / archetypeOpponent on matches logged before
 * auto-classification existed. Classifies from the brought-species lists
 * (idempotent: fills blanks AND heals rows holding a non-archetype value such
 * as a legacy positional-insert timestamp, but leaves valid tags untouched).
 *
 * Reads only the columns it needs and writes with a targeted UPDATE — never a
 * full-row select — so a legacy row with a corrupt JSON column can't break it.
 *
 * POST /api/matches/backfill-archetypes  → { scanned, updated }
 */
export async function POST() {
  try {
    const rows = await db
      .select({
        id: matches.id,
        format: matches.format,
        archetypeSelf: matches.archetypeSelf,
        archetypeOpponent: matches.archetypeOpponent,
        myBrought: matches.myBrought,
        opponentBrought: matches.opponentBrought,
      })
      .from(matches)
      .where(eq(matches.userId, DEFAULT_USER_ID))
      .all();

    let updated = 0;
    for (const m of rows) {
      const format = (m.format as string | null) ?? ACTIVE_REGULATION_FORMAT_ID;
      const patch: Record<string, unknown> = {};

      if (!isKnownArchetype(m.archetypeOpponent)) {
        const arche = archetypeOrNull(
          classifyArchetypeFromSnapshot(null, m.opponentBrought, format),
        );
        if (arche) patch.archetypeOpponent = arche;
      }
      if (!isKnownArchetype(m.archetypeSelf)) {
        const arche = archetypeOrNull(
          classifyArchetypeFromSnapshot(null, m.myBrought, format),
        );
        if (arche) patch.archetypeSelf = arche;
      }

      if (Object.keys(patch).length > 0) {
        patch.updatedAt = Date.now();
        await db.update(matches).set(patch).where(eq(matches.id, m.id)).run();
        updated += 1;
      }
    }

    return Response.json({ scanned: rows.length, updated });
  } catch (error) {
    console.error("POST /api/matches/backfill-archetypes error:", error);
    return Response.json(
      { error: "Failed to backfill archetypes" },
      { status: 500 },
    );
  }
}
