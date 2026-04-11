import type { TeamPokemon } from "@/lib/types/pokemon";
import type { EVSuggestion } from "@/lib/types/ev";
import { aiComplete, isAIAvailable } from "./client";
import { buildEVOptimizerPrompt } from "./prompts/ev-optimizer";
import { getMetaThreats } from "@/lib/ev/meta-lookup";

export async function generateOptimizedSpreads(
  team: TeamPokemon[],
): Promise<EVSuggestion[]> {
  if (!isAIAvailable()) {
    throw new Error(
      "No AI API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local",
    );
  }

  const metaThreats = getMetaThreats().map((t) => ({
    species: t.species,
    usagePercent: t.usagePercent,
  }));

  const prompt = buildEVOptimizerPrompt(team, metaThreats);

  try {
    const response = await aiComplete(prompt, 4096, "ev_optimize");

    console.log(
      `[EV Optimizer] ${response.provider}/${response.model} — input: ${response.inputTokens}, output: ${response.outputTokens}`,
    );

    let jsonText = response.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonText) as EVSuggestion[];

    if (!Array.isArray(parsed)) {
      throw new Error("AI response is not an array");
    }

    return parsed.map((suggestion) => ({
      pokemon: suggestion.pokemon,
      spread: {
        hp: Math.min(252, Math.max(0, suggestion.spread?.hp ?? 0)),
        atk: Math.min(252, Math.max(0, suggestion.spread?.atk ?? 0)),
        def: Math.min(252, Math.max(0, suggestion.spread?.def ?? 0)),
        spa: Math.min(252, Math.max(0, suggestion.spread?.spa ?? 0)),
        spd: Math.min(252, Math.max(0, suggestion.spread?.spd ?? 0)),
        spe: Math.min(252, Math.max(0, suggestion.spread?.spe ?? 0)),
      },
      nature: suggestion.nature ?? "Hardy",
      reasoning: suggestion.reasoning ?? "No reasoning provided.",
      source: "ai_optimized" as const,
    }));
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(
        "[EV Optimizer] Failed to parse response as JSON:",
        error,
      );
      throw new Error("AI response was malformed. Please try again.");
    }
    throw error;
  }
}
