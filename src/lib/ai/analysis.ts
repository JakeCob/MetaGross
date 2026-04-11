import type { BattleMatch } from "@/lib/types/battle";
import type { MatchAnalysis, AIMatchAnalysis } from "@/lib/types/analysis";
import { aiComplete, isAIAvailable } from "./client";
import { buildMatchAnalysisPrompt } from "./prompts/match-analysis";

export async function generateAIMatchAnalysis(
  match: BattleMatch,
  ruleAnalysis: MatchAnalysis,
): Promise<AIMatchAnalysis> {
  if (!isAIAvailable()) {
    throw new Error(
      "No AI API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local",
    );
  }

  const prompt = buildMatchAnalysisPrompt(match, ruleAnalysis);

  try {
    const response = await aiComplete(prompt, 2048, "ai_analysis");

    console.log(
      `[AI Analysis] ${response.provider}/${response.model} — input: ${response.inputTokens}, output: ${response.outputTokens}`,
    );

    // Parse JSON from response (handle potential markdown code fences)
    let jsonText = response.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonText) as AIMatchAnalysis;

    if (!parsed.summary || !parsed.overallAssessment) {
      throw new Error("AI response missing required fields");
    }

    return {
      summary: parsed.summary,
      keyTurningPoints: parsed.keyTurningPoints ?? [],
      improvements: parsed.improvements ?? [],
      strengths: parsed.strengths ?? [],
      overallAssessment: parsed.overallAssessment,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error("[AI Analysis] Failed to parse response as JSON:", error);
      return {
        summary: "AI analysis failed to generate properly.",
        keyTurningPoints: [],
        improvements: [
          "Unable to generate improvements - AI response was malformed.",
        ],
        strengths: [],
        overallAssessment:
          "The AI analysis encountered a parsing error. Please try again.",
      };
    }
    throw error;
  }
}
