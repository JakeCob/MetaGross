import type { EVDebateStateType, EVDebateStateUpdate } from "../state";
import { createModel, detectProvider } from "@/lib/ai/graph/model";
import { AGENT_PERSONAS } from "@/lib/types/agent";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { CHAMPIONS_POINTS } from "@/lib/data/champions";

/**
 * Node: Wolfe Glick reviews the current spread from an aggressive/creative
 * perspective. Suggests modifications and explains reasoning.
 */
export async function wolfeReviewNode(
  state: EVDebateStateType,
): Promise<Partial<EVDebateStateUpdate>> {
  const provider = detectProvider();
  const model = createModel(provider);

  const { pokemon, team, currentSpread, currentNature, format } = state;
  const isChampions = format.toLowerCase().startsWith("champions");
  const totalMax = isChampions ? CHAMPIONS_POINTS.totalMax : 510;
  const perStatMax = isChampions ? CHAMPIONS_POINTS.perStatMax : 252;

  const persona = AGENT_PERSONAS.wolfe_glick;
  const spreadStr = `HP ${currentSpread.hp} / Atk ${currentSpread.atk} / Def ${currentSpread.def} / SpA ${currentSpread.spa} / SpD ${currentSpread.spd} / Spe ${currentSpread.spe}`;

  const teammates = team
    .filter((t) => t.species && t.species !== pokemon.species)
    .map((t) => `${t.species} (${t.ability || "?"}${t.item ? `, ${t.item}` : ""})`)
    .join(", ");

  const systemPrompt = `${persona.systemPromptAddition} Keep your review to 2-3 sentences. Focus on speed tiers, offensive benchmarks${isChampions ? " against Champions Reg M-A threats" : ""}, and creative adjustments. The Nature must match the move categories — flag mismatches (e.g., Adamant on a fully-special set).`;

  const userPrompt = `Review this ${isChampions ? "stat point" : "EV"} spread for ${pokemon.species} (${pokemon.ability}, ${pokemon.item}):
Nature: ${currentNature}
Spread: ${spreadStr}
Moves: ${pokemon.moves.filter(Boolean).join(", ")}
Teammates: ${teammates || "none"}
Max total: ${totalMax}, max per stat: ${perStatMax}.
What would you change and why? Call out nature/moveset mismatches, key speed creeps, and teammate synergy. Be specific about benchmarks.`;

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  const text = typeof response.content === "string"
    ? response.content
    : Array.isArray(response.content)
      ? response.content
          .filter((b): b is { type: "text"; text: string } =>
            typeof b === "object" && b !== null && "type" in b && b.type === "text" && "text" in b,
          )
          .map((b) => b.text)
          .join("")
      : "";

  return { wolfeReview: text.trim() || "No additional comments." };
}
