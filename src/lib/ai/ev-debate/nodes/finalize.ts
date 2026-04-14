import type { EVDebateStateType, EVDebateStateUpdate } from "../state";
import { createModel, detectProvider } from "@/lib/ai/graph/model";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { CHAMPIONS_POINTS } from "@/lib/data/champions";
import type { EVSpread } from "@/lib/types/pokemon";

interface ParsedFinal {
  spread: EVSpread;
  nature: string;
  moves: string[];
  ability: string;
  item: string;
}

/**
 * Parse a full "set" response from the LLM. Same structure as propose.
 */
function parseFinalFromResponse(
  text: string,
  perStatMax: number,
): ParsedFinal | null {
  const spreadMatch = text.match(
    /HP\s*(\d+)\s*\/\s*Atk\s*(\d+)\s*\/\s*Def\s*(\d+)\s*\/\s*SpA\s*(\d+)\s*\/\s*SpD\s*(\d+)\s*\/\s*Spe\s*(\d+)/i,
  );
  if (!spreadMatch) return null;

  const natureMatch = text.match(/Nature:\s*([A-Za-z]+)/i);
  const abilityMatch = text.match(/Ability:\s*([^\n]+)/i);
  const itemMatch = text.match(/Item:\s*([^\n]+)/i);
  const movesMatch = text.match(/Moves:\s*([^\n]+)/i);

  const moves = (movesMatch?.[1] ?? "")
    .split(/\s*\/\s*/)
    .map((m) => m.trim())
    .filter(Boolean)
    .slice(0, 4);

  return {
    spread: {
      hp: Math.min(perStatMax, parseInt(spreadMatch[1], 10)),
      atk: Math.min(perStatMax, parseInt(spreadMatch[2], 10)),
      def: Math.min(perStatMax, parseInt(spreadMatch[3], 10)),
      spa: Math.min(perStatMax, parseInt(spreadMatch[4], 10)),
      spd: Math.min(perStatMax, parseInt(spreadMatch[5], 10)),
      spe: Math.min(perStatMax, parseInt(spreadMatch[6], 10)),
    },
    nature: natureMatch?.[1]?.trim() ?? "Hardy",
    moves,
    ability: abilityMatch?.[1]?.trim() ?? "",
    item: itemMatch?.[1]?.trim() ?? "",
  };
}

/**
 * Node: synthesize the final full set from both personas + the final sim.
 *
 * Consumes the "final" simulation run — the one executed after the
 * personas reviewed — so this node sees the benchmark outcomes of the
 * debated proposal.
 */
export async function finalizeNode(
  state: EVDebateStateType,
): Promise<Partial<EVDebateStateUpdate>> {
  const provider = detectProvider();
  const model = createModel(provider);

  const {
    pokemon,
    team,
    currentSpread,
    currentNature,
    currentMoves,
    currentAbility,
    currentItem,
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
  const movesStr = (currentMoves ?? [])
    .filter(Boolean)
    .join(" / ") || pokemon.moves.filter(Boolean).join(" / ");

  const teammates = team
    .filter((t) => t.species && t.species !== pokemon.species)
    .map((t) => `${t.species} (${t.ability || "?"})`)
    .join(", ");

  const simSummary = simulationResults
    .map(
      (r) =>
        `${r.threat}: ${r.survives ? "Survives" : "KO'd"} (${r.damageRange}), ${r.speedComparison}`,
    )
    .join("\n");

  const systemPrompt = `You are the Final Decision synthesizer${isChampions ? " for Pokemon Champions Reg M-A" : ""}. Merge the two expert opinions and the final simulation data into ONE complete optimized set — Ability + Item + Moves + Nature + ${label}. Total ${label} MUST equal exactly ${totalMax}, max ${perStatMax} per stat. The Nature must match the move categories. Exactly 4 unique moves.`;

  const userPrompt = `Pokemon: ${pokemon.species}
Current proposed set after debate:
  Ability: ${currentAbility || pokemon.ability}
  Item:    ${currentItem || pokemon.item}
  Moves:   ${movesStr}
  Nature:  ${currentNature}
  Spread:  ${spreadStr}

Teammates: ${teammates || "(none)"}

Wolfe Glick's review: "${wolfeReview ?? "None"}"
CybertronVGC's review: "${cybertronReview ?? "None"}"

Final simulation results (benchmarks of the proposed set):
${simSummary || "(no sim data)"}

Produce the FINAL set. Respond EXACTLY in this format (no extra prose):
Ability: <name>
Item: <name>
Moves: Move1 / Move2 / Move3 / Move4
Nature: <NatureName>
Spread: HP <n> / Atk <n> / Def <n> / SpA <n> / SpD <n> / Spe <n>
Reasoning: <2-3 sentences explaining the final decision; cite specific benchmarks and teammate synergy>`;

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

  const parsed = parseFinalFromResponse(text, perStatMax);
  const reasoningMatch = text.match(/Reasoning:\s*([\s\S]+)/i);
  const reasoning = reasoningMatch?.[1]?.trim() ?? "Synthesized from expert reviews and simulation data.";

  if (parsed) {
    const paddedMoves = [...parsed.moves, "", "", "", ""].slice(0, 4);
    return {
      finalSpread: parsed.spread,
      finalNature: parsed.nature,
      finalMoves: paddedMoves,
      finalAbility: parsed.ability || currentAbility || pokemon.ability,
      finalItem: parsed.item || currentItem || pokemon.item,
      finalReasoning: reasoning,
      currentSpread: parsed.spread,
      currentNature: parsed.nature,
      currentMoves: paddedMoves,
      currentAbility: parsed.ability || currentAbility || pokemon.ability,
      currentItem: parsed.item || currentItem || pokemon.item,
      spreadHistory: [
        {
          spread: parsed.spread,
          nature: parsed.nature,
          moves: paddedMoves,
          ability: parsed.ability,
          item: parsed.item,
          source: "finalize",
          reasoning,
        },
      ],
    };
  }

  // Fallback: keep the debated set as final.
  return {
    finalSpread: currentSpread,
    finalNature: currentNature,
    finalMoves: [...currentMoves],
    finalAbility: currentAbility,
    finalItem: currentItem,
    finalReasoning: `${reasoning} (used debated set as fallback)`,
  };
}
