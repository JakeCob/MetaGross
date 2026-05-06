import { NextResponse } from "next/server";
import {
  generatePostMatchAnalysis,
  type PostMatchInput,
} from "@/lib/ai/battle-coach/post-match";
import { updateMatch } from "@/lib/db/queries/matches";

/**
 * POST /api/battle-coach/post-match
 *
 * Body: { matchId?: string, input: PostMatchInput }
 *
 * Runs the two-call post-match analysis (opponent team + battle log)
 * and returns { opponentTeamMd, battleLogMd, generatedAt }. When a
 * matchId is provided, the result is persisted onto the match's
 * ai_analysis_json column and analyzedAt is updated.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      matchId?: string;
      input: PostMatchInput;
    };

    if (!body.input || !Array.isArray(body.input.myTeam)) {
      return NextResponse.json(
        { error: "input.myTeam is required" },
        { status: 400 },
      );
    }

    const result = await generatePostMatchAnalysis(body.input);

    if (body.matchId) {
      await updateMatch(body.matchId, {
        aiAnalysisJson: result,
        analyzedAt: Date.now(),
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[post-match] error:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
