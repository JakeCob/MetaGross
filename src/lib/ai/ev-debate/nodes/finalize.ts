import type { EVDebateStateType, EVDebateStateUpdate } from "../state";
import { createModel, detectProvider } from "@/lib/ai/graph/model";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { CHAMPIONS_POINTS } from "@/lib/data/champions";
import type { EVSpread } from "@/lib/types/pokemon";

/**
 * Parse an EV spread from the finalize LLM response.
 */
function parseSpreadFromResponse(
  text: string,
  perStatMax: number,
): { spread: EVSpread; nature: string } | null {
  const spreadMatch = text.match(
    /HP\s*(\d+)\s*\/\s*Atk\s*(\d+)\s*\/\s*Def\s*(\d+)\s*\/\s*SpA\s*(\d+)\s*\/\s*SpD\s*(\d+)\s*\/\s*Spe\s*(\d+)/i,
  );
  const natureMatch = text.match(/Nature:\s*(\w+)/i);

  if (!spreadMatch) return null;

  return {
    spread: {
      hp: Math.min(perStatMax, parseInt(spreadMatch[1], 10)),
      atk: Math.min(perStatMax, parseInt(spreadMatch[2], 10)),
      def: Math.min(perStatMax, parseInt(spreadMatch[3], 10)),
      spa: Math.min(perStatMax, parseInt(spreadMatch[4], 10)),
      spd: Math.min(perStatMax, parseInt(spreadMatch[5], 10)),
      spe: Math.min(perStatMax, parseInt(spreadMatch[6], 10)),
    },
    nature: natureMatch?.[1] ?? "Hardy",
  };
}

/**
 * Node: finalize the spread. If simulation shows weaknesses and we haven't
 * exhausted iterations, signal a loop. Otherwise, synthesize the final answer.
 *
 * The routing logic (loop vs END) is handled in the graph's conditional edges,
 * not here. This node always produces the final output; the conditional edge
 * checks whether to loop.
 */
export async function finalizeNode(
  state: EVDebateStateType,
): Promise<Partial<EVDebateStateUpdate>> {
  const provider = detectProvider();
  const model = createModel(provider);

  const {
    pokemon,
    currentSpread,
    currentNature,
    wolfeReview,
    cybertronReview,
    simulationResults,
    format,
  } = state;
  const isChampions = format.toLowerCase().startsWith("champions");
  const totalMax = isChampions ? CHAMPIONS_POINTS.totalMax : 510;
  const perStatMax = isChampions ? CHAMPIONS_POINTS.perStatMax : 252;
  const label = isChampions ? "Points" : "EVs";

  const spreadStr = `HP ${currentSpread.hp} / Atk ${currentSpread.atk} / Def ${currentSpread.def} / SpA ${currentSpread.spa} / SpD ${currentSpread.spd} / Spe ${currentSpread.spe}`;

  const simSummary = simulationResults
    .map(
      (r) =>
        `${r.threat}: ${r.survives ? "Survives" : "KO'd"} (${r.damageRange}), ${r.speedComparison}`,
    )
    .join("\n");

  const systemPrompt = `You are an EV optimization synthesizer. Given multiple expert opinions and simulation data, produce the final optimized ${label} spread. Total: ${totalMax}, max ${perStatMax} per stat. The total MUST equal exactly ${totalMax}.`;

  const userPrompt = `Pokemon: ${pokemon.species} (${pokemon.ability}, ${pokemon.item})
Moves: ${pokemon.moves.filter(Boolean).join(", ")}
Current spread: ${currentNature} ${spreadStr}

Wolfe Glick's review: "${wolfeReview ?? "None"}"
CybertronVGC's review: "${cybertronReview ?? "None"}"

Simulation results:
${simSummary}

Produce the final optimized spread. Respond EXACTLY in this format:
Nature: <NatureName>
Spread: HP <n> / Atk <n> / Def <n> / SpA <n> / SpD <n> / Spe <n>
Reasoning: <2-3 sentences explaining the final decision>`;

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

  const parsed = parseSpreadFromResponse(text, perStatMax);
  const reasoningMatch = text.match(/Reasoning:\s*([\s\S]+)/i);
  const reasoning = reasoningMatch?.[1]?.trim() ?? "Synthesized from expert reviews and simulation data.";

  if (parsed) {
    return {
      finalSpread: parsed.spread,
      finalNature: parsed.nature,
      finalReasoning: reasoning,
      currentSpread: parsed.spread,
      currentNature: parsed.nature,
      spreadHistory: [
        {
          spread: parsed.spread,
          nature: parsed.nature,
          source: "finalize",
          reasoning,
        },
      ],
    };
  }

  // Fallback: use the current spread as final
  return {
    finalSpread: currentSpread,
    finalNature: currentNature,
    finalReasoning: `${reasoning} (used current spread as fallback)`,
  };
}
