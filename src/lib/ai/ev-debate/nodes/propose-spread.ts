import type { EVDebateStateType, EVDebateStateUpdate } from "../state";
import { createModel, detectProvider } from "@/lib/ai/graph/model";
import { getMetaThreats } from "@/lib/ev/meta-lookup";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import type { EVSpread } from "@/lib/types/pokemon";
import { CHAMPIONS_POINTS } from "@/lib/data/champions";

/**
 * Parse an EV spread and nature from the LLM response.
 * Expects a line like: "HP 24 / Atk 0 / Def 4 / SpA 0 / SpD 28 / Spe 10"
 * and a line like: "Nature: Adamant"
 */
function parseSpreadFromResponse(
  text: string,
  totalMax: number,
  perStatMax: number,
): { spread: EVSpread; nature: string } | null {
  const spreadMatch = text.match(
    /HP\s*(\d+)\s*\/\s*Atk\s*(\d+)\s*\/\s*Def\s*(\d+)\s*\/\s*SpA\s*(\d+)\s*\/\s*SpD\s*(\d+)\s*\/\s*Spe\s*(\d+)/i,
  );
  const natureMatch = text.match(/Nature:\s*(\w+)/i);

  if (!spreadMatch) return null;

  const spread: EVSpread = {
    hp: Math.min(perStatMax, parseInt(spreadMatch[1], 10)),
    atk: Math.min(perStatMax, parseInt(spreadMatch[2], 10)),
    def: Math.min(perStatMax, parseInt(spreadMatch[3], 10)),
    spa: Math.min(perStatMax, parseInt(spreadMatch[4], 10)),
    spd: Math.min(perStatMax, parseInt(spreadMatch[5], 10)),
    spe: Math.min(perStatMax, parseInt(spreadMatch[6], 10)),
  };

  const total = spread.hp + spread.atk + spread.def + spread.spa + spread.spd + spread.spe;
  if (total > totalMax) return null;

  return {
    spread,
    nature: natureMatch?.[1] ?? "Hardy",
  };
}

/**
 * Node: propose an initial EV spread for the Pokemon.
 * Uses the LLM with meta threat context.
 */
export async function proposeSpreadNode(
  state: EVDebateStateType,
): Promise<Partial<EVDebateStateUpdate>> {
  const provider = detectProvider();
  const model = createModel(provider);

  const { pokemon, team, format } = state;
  const isChampions = format.toLowerCase().startsWith("champions");
  const totalMax = isChampions ? CHAMPIONS_POINTS.totalMax : 510;
  const perStatMax = isChampions ? CHAMPIONS_POINTS.perStatMax : 252;
  const label = isChampions ? "Points" : "EVs";

  const threats = getMetaThreats(format);
  const threatList = threats
    .slice(0, 10)
    .map((t) => `${t.species} (${t.usagePercent}%)`)
    .join(", ");

  const teammates = team
    .filter((t) => t.species && t.species !== pokemon.species)
    .map((t) => {
      const moves = (t.moves ?? []).filter(Boolean).slice(0, 4).join("/");
      const parts = [
        t.species,
        t.ability ? `ability=${t.ability}` : null,
        t.item ? `item=${t.item}` : null,
        t.nature ? `nature=${t.nature}` : null,
        moves ? `moves=${moves}` : null,
      ].filter(Boolean);
      return `  • ${parts.join(", ")}`;
    })
    .join("\n");

  // Surface the user's CURRENT configured spread as the starting point.
  const userSpread = pokemon.evs;
  const userSpreadLine =
    userSpread && Object.values(userSpread).some((v) => v > 0)
      ? `User's current spread (starting point — refine, don't ignore): ${pokemon.nature || "Hardy"} — HP ${userSpread.hp} / Atk ${userSpread.atk} / Def ${userSpread.def} / SpA ${userSpread.spa} / SpD ${userSpread.spd} / Spe ${userSpread.spe}`
      : `User has not set a spread yet — propose one from scratch.`;

  // Categorize moves so the nature suggestion is coherent.
  const moveList = pokemon.moves.filter(Boolean);
  const moveHint =
    moveList.length > 0
      ? `Moves on this set: ${moveList.join(", ")}. The proposed Nature MUST align with the category of the offensive moves (boost Atk for physical moves, SpA for special moves, never boost an unused attacking stat).`
      : "No moves chosen yet.";

  // Include feedback from previous iteration if available
  let feedbackSection = "";
  if (state.iterations > 0 && state.simulationResults.length > 0) {
    const failures = state.simulationResults.filter((r) => !r.survives);
    if (failures.length > 0) {
      feedbackSection = `\nPREVIOUS ITERATION FEEDBACK:\nThe last spread failed these checks:\n${failures.map((f) => `- vs ${f.threat}: ${f.damageRange}, ${f.speedComparison}`).join("\n")}`;
      if (state.wolfeReview) feedbackSection += `\nWolfe said: ${state.wolfeReview}`;
      if (state.cybertronReview) feedbackSection += `\nCybertron said: ${state.cybertronReview}`;
      feedbackSection += `\nAdjust the spread to address these weaknesses.`;
    }
  }

  const systemPrompt = `You are an EV spread specialist for VGC doubles${isChampions ? " in Pokemon Champions Regulation M-A" : ""}. Propose optimal ${label} for the given Pokemon. ${isChampions ? `Total must equal ${totalMax}, max ${perStatMax} per stat.` : `Total must equal 510, max 252 per stat.`} Spread across 3-5 stats based on benchmarks. Consider the user's current spread as a starting point (refine, don't ignore it unless clearly wrong). The Nature MUST match the actual offensive category of the moveset.`;

  const userPrompt = `Pokemon: ${pokemon.species}
Ability: ${pokemon.ability}
Item: ${pokemon.item}
${moveHint}
${userSpreadLine}

Teammates on this team:
${teammates || "  • None yet"}

Top meta threats in this format (defensive benchmarks should target these): ${threatList}
${feedbackSection}

Respond with EXACTLY this format (nothing else):
Nature: <NatureName>
Spread: HP <n> / Atk <n> / Def <n> / SpA <n> / SpD <n> / Spe <n>
Reasoning: <1-2 sentences>`;

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

  const parsed = parseSpreadFromResponse(text, totalMax, perStatMax);
  const reasoningMatch = text.match(/Reasoning:\s*(.+)/i);
  const reasoning = reasoningMatch?.[1]?.trim() ?? "Initial spread proposal.";

  if (parsed) {
    return {
      currentSpread: parsed.spread,
      currentNature: parsed.nature,
      spreadHistory: [
        {
          spread: parsed.spread,
          nature: parsed.nature,
          source: "spread_specialist",
          reasoning,
        },
      ],
      iterations: state.iterations + 1,
    };
  }

  // Fallback: use a simple offensive or defensive spread
  const fallbackSpread: EVSpread = isChampions
    ? { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }
    : { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 };

  return {
    currentSpread: fallbackSpread,
    currentNature: "Adamant",
    spreadHistory: [
      {
        spread: fallbackSpread,
        nature: "Adamant",
        source: "spread_specialist",
        reasoning: "Fallback: LLM response could not be parsed.",
      },
    ],
    iterations: state.iterations + 1,
  };
}
