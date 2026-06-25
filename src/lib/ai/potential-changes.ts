import type { TeamPokemon } from "@/lib/types/pokemon";
import type { PotentialChangeAnalysis } from "@/lib/types/analysis";
import { aiComplete, isAIAvailable } from "./client";
import { buildPotentialChangesPrompt } from "./prompts/potential-changes";
import { parseJsonResponse } from "./parse-json";
import { isChampionsItem, isChampionsPokemon } from "@/lib/data/champions";

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
    // Drop roster swaps whose named Pokémon isn't legal in this format (the
    // model hallucinates off-format mons like Bronzong / Gastrodon otherwise).
    swaps: parsed.swaps
      .filter((s) => !s.addMon || isChampionsPokemon(s.addMon, format))
      .slice(0, 6)
      .map((s) => ({ title: s.title, reasoning: s.reasoning, addMon: s.addMon?.trim() || undefined })),
    setTweaks: parsed.setTweaks.slice(0, 8).map((t) => ({
      species: t.species,
      suggestion: t.suggestion,
      apply: sanitizeApply(t.apply, format),
    })),
    note: parsed.note,
  };
}

/** Keep only the structured fields the UI can act on; drop empties AND any item
 *  that isn't legal in the format, so the "Apply" button never applies an
 *  off-format item (e.g. Assault Vest in Champions). */
function sanitizeApply(
  apply: PotentialChangeAnalysis["setTweaks"][number]["apply"],
  format: string,
): PotentialChangeAnalysis["setTweaks"][number]["apply"] {
  if (!apply || typeof apply !== "object") return undefined;
  const out: NonNullable<typeof apply> = {};
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const item = str(apply.item);
  if (item && isChampionsItem(item, format)) out.item = item;
  if (str(apply.ability)) out.ability = str(apply.ability);
  if (str(apply.nature)) out.nature = str(apply.nature);
  if (str(apply.addMove)) out.addMove = str(apply.addMove);
  return Object.keys(out).length > 0 ? out : undefined;
}
