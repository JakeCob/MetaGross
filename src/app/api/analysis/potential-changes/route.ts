import { generatePotentialChanges } from "@/lib/ai/potential-changes";
import { db } from "@/lib/db";
import { analysisCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { PotentialChangeAnalysis } from "@/lib/types/analysis";

export const runtime = "nodejs";

/** Stable key over the full sets (set tweaks depend on items/moves, not just species). */
function teamKey(team: TeamPokemon[]): string {
  return team
    .filter((p) => p.species)
    .map((p) => `${p.species}@${p.item ?? ""}:${(p.moves ?? []).filter(Boolean).join("/")}`)
    .sort()
    .join("|");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { team, format } = body as { team: TeamPokemon[]; format: string };

    if (!Array.isArray(team) || team.filter((p) => p?.species).length < 2 || !format) {
      return Response.json(
        { error: "Provide a team of at least 2 Pokémon + a format." },
        { status: 400 },
      );
    }
    if (!process.env.OPENAI_API_KEY && !process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "No AI API key configured." }, { status: 503 });
    }

    // v2: legality-aware prompt + validation (drops off-format items/Pokémon).
    const cacheKey = `potential-changes:v2:${format}:${teamKey(team)}`;
    const cached = await db
      .select()
      .from(analysisCache)
      .where(eq(analysisCache.cacheKey, cacheKey))
      .get();
    if (cached && cached.expiresAt && cached.expiresAt > Date.now()) {
      return Response.json({ analysis: cached.resultJson as PotentialChangeAnalysis, cached: true });
    }

    const analysis = await generatePotentialChanges(team, format);
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    if (cached) {
      await db
        .update(analysisCache)
        .set({ resultJson: analysis as unknown as Record<string, unknown>, expiresAt, createdAt: Date.now() })
        .where(eq(analysisCache.cacheKey, cacheKey))
        .run();
    } else {
      await db
        .insert(analysisCache)
        .values({
          cacheKey,
          cacheType: "potential-changes",
          resultJson: analysis as unknown as Record<string, unknown>,
          model: "claude-sonnet-4-5-20250929",
          expiresAt,
        })
        .run();
    }

    return Response.json({ analysis, cached: false });
  } catch (error) {
    console.error("POST /api/analysis/potential-changes error:", error);
    return Response.json(
      { error: "Failed to generate analysis", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
