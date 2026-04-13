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

  const { pokemon, team, currentSpread, currentNature, wolfeReview, format } = state;
  const isChampions = format.toLowerCase().startsWith("champions");
  const totalMax = isChampions ? CHAMPIONS_POINTS.totalMax : 510;
  const perStatMax = isChampions ? CHAMPIONS_POINTS.perStatMax : 252;

  const persona = AGENT_PERSONAS.cybertron;
  const spreadStr = `HP ${currentSpread.hp} / Atk ${currentSpread.atk} / Def ${currentSpread.def} / SpA ${currentSpread.spa} / SpD ${currentSpread.spd} / Spe ${currentSpread.spe}`;

  const teammates = team
    .filter((t) => t.species && t.species !== pokemon.species)
    .map((t) => `${t.species} (${t.ability || "?"}${t.item ? `, ${t.item}` : ""})`)
    .join(", ");

  const systemPrompt = `${persona.systemPromptAddition} Keep your review to 2-3 sentences. Focus on survival benchmarks${isChampions ? " against Champions Reg M-A threats (Sneasler, Archaludon, Kingambit, Garchomp, Dragonite-Mega, Tyranitar-Mega, Charizard-Mega-Y)" : ""}, defensive calcs, and fundamental consistency. Flag any Nature/moveset mismatch the user's spread has.`;

  const userPrompt = `Review this ${isChampions ? "stat point" : "EV"} spread for ${pokemon.species} (${pokemon.ability}, ${pokemon.item}):
Nature: ${currentNature}
Spread: ${spreadStr}
Moves: ${pokemon.moves.filter(Boolean).join(", ")}
Teammates: ${teammates || "none"}
Max total: ${totalMax}, max per stat: ${perStatMax}.
Wolfe Glick said: "${wolfeReview ?? "No comment yet."}"
Do you agree or disagree? What would you change? Consider teammate coverage. Be specific about survival calcs vs the format's top threats.`;

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
