import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getMatchById } from "@/lib/db/queries/matches";

export const getMatchContextTool = new DynamicStructuredTool({
  name: "get_match_context",
  description:
    "Load full match data including teams, turns, and analysis results by match ID. Use this to understand the context of a specific battle.",
  schema: z.object({
    matchId: z.string().describe("The match UUID to look up"),
  }),
  func: async ({ matchId }) => {
    const match = await getMatchById(matchId);

    if (!match) {
      return JSON.stringify({ error: `Match not found: ${matchId}` });
    }

    return JSON.stringify({
      id: match.id,
      format: match.format,
      mode: match.mode,
      result: match.result,
      playedAt: match.playedAt,
      opponentName: match.opponentName,
      notes: match.notes,
      myTeam: match.myTeam,
      opponentTeam: match.opponentTeam,
      myBrought: match.myBrought,
      opponentBrought: match.opponentBrought,
      myLeads: match.myLeads,
      opponentLeads: match.opponentLeads,
      archetypeSelf: match.archetypeSelf,
      archetypeOpponent: match.archetypeOpponent,
      ruleAnalysis: match.ruleAnalysisJson,
      aiAnalysis: match.aiAnalysisJson,
      turnCount: match.turns.length,
      turns: match.turns.slice(0, 20), // limit to prevent huge payloads
    });
  },
});
