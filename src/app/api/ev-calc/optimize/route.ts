import { generateOptimizedSpreads } from "@/lib/ai/ev-optimizer";
import { db } from "@/lib/db";
import { analysisCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { EVSuggestion } from "@/lib/types/ev";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { team } = body as { team: TeamPokemon[] };

    if (!team || !Array.isArray(team) || team.length === 0) {
      return Response.json(
        { error: "Missing required field: team (array of TeamPokemon)" },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY && !process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: "No AI API key configured. Set OPENAI_API_KEY, OPENROUTER_API_KEY, or ANTHROPIC_API_KEY in .env" },
        { status: 503 },
      );
    }

    // Generate cache key from team composition
    const teamKey = team
      .map((p) => `${p.species}:${p.item}:${p.moves.join("+")}`)
      .sort()
      .join("|");
    const cacheKey = `ev-optimize:${teamKey}`;

    // Check cache
    const cached = await db
      .select()
      .from(analysisCache)
      .where(eq(analysisCache.cacheKey, cacheKey))
      .get();

    if (cached && cached.expiresAt && cached.expiresAt > Date.now()) {
      return Response.json({
        suggestions: cached.resultJson as EVSuggestion[],
        cached: true,
      });
    }

    // Generate optimized spreads
    const suggestions = await generateOptimizedSpreads(team);

    // Cache the result (expires in 7 days - EV spreads don't change often)
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    if (cached) {
      await db
        .update(analysisCache)
        .set({
          resultJson: suggestions as unknown as Record<string, unknown>,
          expiresAt,
          createdAt: Date.now(),
        })
        .where(eq(analysisCache.cacheKey, cacheKey))
        .run();
    } else {
      await db
        .insert(analysisCache)
        .values({
          cacheKey,
          cacheType: "ev-optimization",
          resultJson: suggestions as unknown as Record<string, unknown>,
          model: "claude-sonnet-4-5-20250929",
          expiresAt,
        })
        .run();
    }

    return Response.json({
      suggestions,
      cached: false,
    });
  } catch (error) {
    console.error("EV optimization error:", error);
    return Response.json(
      {
        error: "Failed to generate EV suggestions",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
