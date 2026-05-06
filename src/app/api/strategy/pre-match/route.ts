import { generatePreMatchStrategy } from "@/lib/ai/pre-match";
import { db } from "@/lib/db";
import { analysisCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { PreMatchStrategy } from "@/lib/types/analysis";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { myTeam, opponentTeam, format } = body as {
      myTeam: TeamPokemon[];
      opponentTeam: Partial<TeamPokemon>[];
      format: string;
    };

    if (!myTeam || !opponentTeam || !format) {
      return Response.json(
        { error: "Missing required fields: myTeam, opponentTeam, format" },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY && !process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: "No AI API key configured. Set OPENAI_API_KEY, OPENROUTER_API_KEY, or ANTHROPIC_API_KEY in .env" },
        { status: 503 },
      );
    }

    // Generate cache key from team compositions
    const mySpecies = myTeam.map((p) => p.species).sort().join(",");
    const oppSpecies = opponentTeam.map((p) => p.species).filter(Boolean).sort().join(",");
    const cacheKey = `pre-match:${format}:${mySpecies}:${oppSpecies}`;

    // Check cache
    const cached = await db
      .select()
      .from(analysisCache)
      .where(eq(analysisCache.cacheKey, cacheKey))
      .get();

    if (cached && cached.expiresAt && cached.expiresAt > Date.now()) {
      return Response.json({
        strategy: cached.resultJson as PreMatchStrategy,
        cached: true,
      });
    }

    // Generate strategy
    const strategy = await generatePreMatchStrategy(myTeam, opponentTeam, format);

    // Cache the result (expires in 24 hours)
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    if (cached) {
      await db
        .update(analysisCache)
        .set({
          resultJson: strategy as unknown as Record<string, unknown>,
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
          cacheType: "pre-match-strategy",
          resultJson: strategy as unknown as Record<string, unknown>,
          model: "claude-sonnet-4-5-20250929",
          expiresAt,
        })
        .run();
    }

    return Response.json({
      strategy,
      cached: false,
    });
  } catch (error) {
    console.error("Pre-match strategy error:", error);
    return Response.json(
      {
        error: "Failed to generate strategy",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
