import type { BattleMatch } from "@/lib/types/battle";
import type { MatchAnalysis } from "@/lib/types/analysis";

export function buildMatchAnalysisPrompt(
  match: BattleMatch,
  ruleAnalysis: MatchAnalysis,
): { system: string; user: string } {
  const system = `You are an expert Pokemon VGC doubles coach analyzing a completed battle. You are reviewing turn-by-turn data and a rule-based engine analysis to provide actionable coaching feedback.

Your response MUST be valid JSON matching this exact schema:
{
  "summary": "2-3 sentence match summary describing what happened and the outcome",
  "keyTurningPoints": [{ "turn": <number>, "description": "<why this turn mattered>" }],
  "improvements": ["<specific actionable improvement>", ...],
  "strengths": ["<specific thing the player did well>", ...],
  "overallAssessment": "<1 paragraph overall assessment of the player's performance>"
}

Guidelines:
- Identify key turning points and explain WHY they mattered (not just what happened)
- Grade overall match performance based on the rule-based engine's move grades
- Suggest 3-5 specific, actionable improvements (not generic advice)
- Identify strengths the player showed (good reads, positioning, timing)
- Keep responses concise and actionable - no fluff
- Reference specific turns and Pokemon when possible
- Consider VGC doubles-specific factors: positioning, speed control, redirection, synergy`;

  const turnSummaries = match.turns.map((turn) => {
    const p1Actions = turn.actions
      .filter((a) => a.side === "p1")
      .map((a) => {
        if (a.actionType === "move" || a.actionType === "mega_move") {
          const mega = a.megaEvolved ? " (Mega Evolved)" : "";
          const ko = a.wasKo ? " [KO!]" : "";
          const dmg = a.damageDealtPercent ? ` (${a.damageDealtPercent}% dmg)` : "";
          return `${a.moveName}${mega}${dmg}${ko}`;
        }
        if (a.actionType === "switch") {
          return `Switch: ${a.switchOutSpecies} -> ${a.switchInSpecies}`;
        }
        return a.actionType;
      })
      .join(", ");

    const p2Actions = turn.actions
      .filter((a) => a.side === "p2")
      .map((a) => {
        if (a.actionType === "move" || a.actionType === "mega_move") {
          const ko = a.wasKo ? " [KO!]" : "";
          const dmg = a.damageDealtPercent ? ` (${a.damageDealtPercent}% dmg)` : "";
          return `${a.moveName}${dmg}${ko}`;
        }
        if (a.actionType === "switch") {
          return `Switch: ${a.switchOutSpecies} -> ${a.switchInSpecies}`;
        }
        return a.actionType;
      })
      .join(", ");

    const weather = turn.fieldState.weather ? ` | Weather: ${turn.fieldState.weather}` : "";
    const terrain = turn.fieldState.terrain ? ` | Terrain: ${turn.fieldState.terrain}` : "";
    const tr = turn.fieldState.trickRoom ? " | Trick Room" : "";

    return `Turn ${turn.number}: P1[${p1Actions}] vs P2[${p2Actions}]${weather}${terrain}${tr}`;
  });

  const gradeSummary = ruleAnalysis.summary;
  const score = ruleAnalysis.overallScore;
  const turningPoints = ruleAnalysis.turningPoints;

  const user = `Match Data:
- Format: ${match.format}
- Result: ${match.result}
- My Team: ${match.myTeam.map((p) => p.species).join(", ")}
- Opponent Team: ${match.opponentTeam.map((p) => p.species).join(", ")}
- My Leads: ${match.myLeads.join(", ")}
- Opponent Leads: ${match.opponentLeads.join(", ")}
- Brought (me): ${match.myBrought.join(", ")}
- Brought (opp): ${match.opponentBrought.join(", ")}

Turn-by-Turn:
${turnSummaries.join("\n")}

Rule-Based Engine Analysis:
- Overall Score: ${score}/100
- Total Moves: ${gradeSummary.totalMoves}
- Optimal: ${gradeSummary.optimalCount}, Good: ${gradeSummary.goodCount}, Inaccuracy: ${gradeSummary.inaccuracyCount}, Mistake: ${gradeSummary.mistakeCount}, Blunder: ${gradeSummary.blunderCount}
- Turning Points (turns): ${turningPoints.join(", ") || "none detected"}
- Win Probability Curve: ${ruleAnalysis.winProbabilityCurve.map((p) => `T${p.turn}:${p.probability}%`).join(", ")}

Please analyze this match and provide your coaching feedback as JSON.`;

  return { system, user };
}
