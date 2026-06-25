import type { TeamPokemon } from "@/lib/types/pokemon";
import type { CommonCombinationsAnalysis } from "@/lib/types/analysis";
import { aiComplete, isAIAvailable } from "./client";
import { buildCommonCombinationsPrompt } from "./prompts/common-combinations";
import { parseJsonResponse } from "./parse-json";

export async function generateCommonCombinations(
  team: TeamPokemon[],
  format: string,
): Promise<CommonCombinationsAnalysis> {
  if (!isAIAvailable()) {
    throw new Error("No AI API key configured.");
  }

  const prompt = buildCommonCombinationsPrompt(team, format);
  const response = await aiComplete(prompt, 1500, "ai_analysis");
  console.log(
    `[Common Combinations] ${response.provider}/${response.model} — in ${response.inputTokens}, out ${response.outputTokens}`,
  );

  const parsed = parseJsonResponse<CommonCombinationsAnalysis>(response.text);
  if (!Array.isArray(parsed.combos)) {
    throw new Error("AI response missing required field (combos).");
  }
  return {
    combos: parsed.combos
      .filter((c) => Array.isArray(c.leads) && c.strategy)
      .slice(0, 4)
      .map((c) => ({
        leads: (c.leads ?? []).slice(0, 2),
        back: (c.back ?? []).slice(0, 2),
        strategy: c.strategy,
      })),
    note: parsed.note,
  };
}
