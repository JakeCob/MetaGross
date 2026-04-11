import type { TeamPokemon } from "@/lib/types/pokemon";
import type { PreMatchStrategy } from "@/lib/types/analysis";
import { aiComplete, isAIAvailable } from "./client";
import { buildPreMatchPrompt } from "./prompts/pre-match-strategy";

export async function generatePreMatchStrategy(
  myTeam: TeamPokemon[],
  opponentTeam: Partial<TeamPokemon>[],
  format: string,
): Promise<PreMatchStrategy> {
  if (!isAIAvailable()) {
    throw new Error(
      "No AI API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local",
    );
  }

  const prompt = buildPreMatchPrompt(myTeam, opponentTeam, format);

  try {
    const response = await aiComplete(prompt, 2048, "pre_match");

    console.log(
      `[Pre-Match Strategy] ${response.provider}/${response.model} — input: ${response.inputTokens}, output: ${response.outputTokens}`,
    );

    let jsonText = response.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonText) as PreMatchStrategy;

    if (!parsed.recommendedLeads || !parsed.gamePlan) {
      throw new Error("AI response missing required fields");
    }

    return {
      recommendedLeads: parsed.recommendedLeads,
      recommendedBring4: parsed.recommendedBring4,
      gamePlan: parsed.gamePlan,
      keyThreats: parsed.keyThreats ?? [],
      megaTiming: parsed.megaTiming ?? "No specific Mega timing advice.",
      winCondition: parsed.winCondition ?? "Not specified.",
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(
        "[Pre-Match Strategy] Failed to parse response as JSON:",
        error,
      );
      throw new Error("AI response was malformed. Please try again.");
    }
    throw error;
  }
}
