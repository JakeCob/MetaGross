import { getMatchById, updateMatch } from "@/lib/db/queries/matches";
import { analyzeMatch } from "@/lib/engine/analyze-match";
import { generateAIMatchAnalysis } from "@/lib/ai/analysis";
import type { BattleMatch, Turn, TurnAction, FieldState, ActivePokemon } from "@/lib/types/battle";
import { DEFAULT_FIELD_STATE } from "@/lib/types/battle";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { MatchAnalysis, AIMatchAnalysis } from "@/lib/types/analysis";

/**
 * Convert DB match row to the BattleMatch type expected by the analysis engine.
 */
function toBattleMatch(
  match: NonNullable<Awaited<ReturnType<typeof getMatchById>>>,
): BattleMatch {
  const myTeam = (Array.isArray(match.myTeam) ? match.myTeam : []) as TeamPokemon[];
  const opponentTeam = (Array.isArray(match.opponentTeam) ? match.opponentTeam : []) as Partial<TeamPokemon>[];
  const myBrought = (Array.isArray(match.myBrought) ? match.myBrought : []) as string[];
  const opponentBrought = (Array.isArray(match.opponentBrought) ? match.opponentBrought : []) as string[];
  const myLeads = (Array.isArray(match.myLeads) ? match.myLeads : []) as string[];
  const opponentLeads = (Array.isArray(match.opponentLeads) ? match.opponentLeads : []) as string[];

  const turns: Turn[] = match.turns.map((t) => {
    const fieldState = (t.fieldState as FieldState) ?? { ...DEFAULT_FIELD_STATE };
    const activeP1 = (Array.isArray(t.activeP1) ? t.activeP1 : []) as ActivePokemon[];
    const activeP2 = (Array.isArray(t.activeP2) ? t.activeP2 : []) as ActivePokemon[];

    const actions: TurnAction[] = t.actions.map((a) => ({
      side: (a.side as "p1" | "p2") ?? "p1",
      slot: (a.slot as 1 | 2) ?? 1,
      actionType: (a.actionType as TurnAction["actionType"]) ?? "nothing",
      moveName: a.moveName ?? undefined,
      targetSide: (a.targetSide as "p1" | "p2" | undefined) ?? undefined,
      targetSlot: (a.targetSlot as 1 | 2 | undefined) ?? undefined,
      damageDealtPercent: a.damageDealtPercent ?? undefined,
      wasCriticalHit: a.wasCriticalHit === 1,
      wasKo: a.wasKo === 1,
      switchInSpecies: a.switchInSpecies ?? undefined,
      switchOutSpecies: a.switchOutSpecies ?? undefined,
      megaEvolved: a.megaEvolved === 1,
    }));

    return {
      number: t.turnNumber ?? 0,
      actions,
      fieldState,
      activeP1,
      activeP2,
      winProbability: t.winProbability ?? undefined,
      isTurningPoint: t.isTurningPoint === 1,
    };
  });

  return {
    id: match.id,
    format: match.format ?? "unknown",
    mode: (match.mode as BattleMatch["mode"]) ?? "quick",
    result: (match.result as BattleMatch["result"]) ?? "loss",
    playedAt: new Date(match.playedAt ?? Date.now()),
    notes: match.notes ?? undefined,
    myTeam,
    opponentTeam,
    myBrought,
    opponentBrought,
    myLeads,
    opponentLeads,
    turns,
    opponentName: match.opponentName ?? undefined,
    archetypeSelf: match.archetypeSelf ?? undefined,
    archetypeOpponent: match.archetypeOpponent ?? undefined,
    ruleAnalysis: match.ruleAnalysisJson as MatchAnalysis | undefined,
  };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params;

  try {
    const match = await getMatchById(matchId);

    if (!match) {
      return Response.json(
        { error: "Match not found" },
        { status: 404 },
      );
    }

    // Return cached analysis if available
    if (match.ruleAnalysisJson && match.aiAnalysisJson) {
      return Response.json({
        matchId,
        analysis: match.ruleAnalysisJson as MatchAnalysis,
        aiAnalysis: match.aiAnalysisJson as AIMatchAnalysis,
        cached: true,
      });
    }

    // Convert to BattleMatch type and run rule-based analysis
    const battleMatch = toBattleMatch(match);
    let ruleAnalysis: MatchAnalysis;

    if (match.ruleAnalysisJson) {
      ruleAnalysis = match.ruleAnalysisJson as MatchAnalysis;
    } else {
      ruleAnalysis = analyzeMatch(battleMatch);
      // Save rule analysis to database
      await updateMatch(matchId, {
        ruleAnalysisJson: ruleAnalysis as unknown,
        analyzedAt: Date.now(),
      });
    }

    // Generate AI analysis if API key is available
    let aiAnalysis: AIMatchAnalysis | null = null;

    if (match.aiAnalysisJson) {
      aiAnalysis = match.aiAnalysisJson as AIMatchAnalysis;
    } else if (process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY) {
      try {
        aiAnalysis = await generateAIMatchAnalysis(battleMatch, ruleAnalysis);
        // Cache the AI analysis
        await updateMatch(matchId, {
          aiAnalysisJson: aiAnalysis as unknown,
        });
      } catch (aiError) {
        console.error("AI analysis failed (non-blocking):", aiError);
        // AI analysis is optional - still return rule-based
      }
    }

    return Response.json({
      matchId,
      analysis: ruleAnalysis,
      aiAnalysis,
      cached: false,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return Response.json(
      { error: "Analysis failed", details: String(error) },
      { status: 500 },
    );
  }
}
