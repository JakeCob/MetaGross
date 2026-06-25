import type { TeamPokemon } from "@/lib/types/pokemon";
import type { PotentialChangeAnalysis } from "@/lib/types/analysis";
import { aiComplete, isAIAvailable } from "./client";
import { buildPotentialChangesPrompt } from "./prompts/potential-changes";
import { parseJsonResponse } from "./parse-json";

export async function generatePotentialChanges(
  team: TeamPokemon[],
  format: string,
): Promise<PotentialChangeAnalysis> {
  if (!isAIAvailable()) {
    throw new Error("No AI API key configured.");
  }

  const prompt = buildPotentialChangesPrompt(team, format);
  const response = await aiComplete(prompt, 1500, "ai_analysis");
  console.log(
    `[Potential Changes] ${response.provider}/${response.model} — in ${response.inputTokens}, out ${response.outputTokens}`,
  );

  const parsed = parseJsonResponse<PotentialChangeAnalysis>(response.text);
  if (!Array.isArray(parsed.swaps) || !Array.isArray(parsed.setTweaks)) {
    throw new Error("AI response missing required fields (swaps/setTweaks).");
  }
  return {
    swaps: parsed.swaps.slice(0, 6),
    setTweaks: parsed.setTweaks.slice(0, 8),
    note: parsed.note,
  };
}
