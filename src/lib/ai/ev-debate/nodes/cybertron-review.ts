import type { EVDebateStateType, EVDebateStateUpdate } from "../state";
import { createModel, detectProvider } from "@/lib/ai/graph/model";
import { AGENT_PERSONAS } from "@/lib/types/agent";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { CHAMPIONS_POINTS } from "@/lib/data/champions";

/**
 * Node: CybertronVGC (Aaron Zheng) reviews the current spread from a
 * methodical/fundamental perspective, also considering Wolfe's input.
 */
export async function cybertronReviewNode(
  state: EVDebateStateType,
): Promise<Partial<EVDebateStateUpdate>> {
  const provider = detectProvider();
  const model = createModel(provider);

  const { pokemon, currentSpread, currentNature, wolfeReview, format } = state;
  const isChampions = format.toLowerCase().startsWith("champions");
  const totalMax = isChampions ? CHAMPIONS_POINTS.totalMax : 510;
  const perStatMax = isChampions ? CHAMPIONS_POINTS.perStatMax : 252;

  const persona = AGENT_PERSONAS.cybertron;
  const spreadStr = `HP ${currentSpread.hp} / Atk ${currentSpread.atk} / Def ${currentSpread.def} / SpA ${currentSpread.spa} / SpD ${currentSpread.spd} / Spe ${currentSpread.spe}`;

  const systemPrompt = `${persona.systemPromptAddition} Keep your review to 2-3 sentences. Focus on survival benchmarks, defensive calcs, and fundamental consistency.`;

  const userPrompt = `Review this ${isChampions ? "stat point" : "EV"} spread for ${pokemon.species} (${pokemon.ability}, ${pokemon.item}):
Nature: ${currentNature}
Spread: ${spreadStr}
Moves: ${pokemon.moves.filter(Boolean).join(", ")}
Max total: ${totalMax}, max per stat: ${perStatMax}.
Wolfe Glick said: "${wolfeReview ?? "No comment yet."}"
Do you agree or disagree? What would you change? Be specific about survival calcs.`;

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

  return { cybertronReview: text.trim() || "No additional comments." };
}
