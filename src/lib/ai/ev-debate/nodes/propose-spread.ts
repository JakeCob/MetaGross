import type { EVDebateStateType, EVDebateStateUpdate } from "../state";
import { createModel, detectProvider } from "@/lib/ai/graph/model";
import { getMetaThreats } from "@/lib/ev/meta-lookup";
import {
  getReferenceSetsForSpecies,
  formatReferenceSetsBlock,
} from "@/lib/meta-teams/species-sets";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import type { EVSpread } from "@/lib/types/pokemon";
import { CHAMPIONS_POINTS } from "@/lib/data/champions";

interface ParsedSet {
  spread: EVSpread;
  nature: string;
  moves: string[];
  ability: string;
  item: string;
  reasoning: string;
}

/**
 * Parse a structured "set" response from the LLM.
 * Expected format:
 *   Ability: <name>
 *   Item: <name>
 *   Moves: move1 / move2 / move3 / move4
 *   Nature: <NatureName>
 *   Spread: HP n / Atk n / Def n / SpA n / SpD n / Spe n
 *   Reasoning: <text>
 */
function parseSetFromResponse(
  text: string,
  totalMax: number,
  perStatMax: number,
): ParsedSet | null {
  const spreadMatch = text.match(
    /HP\s*(\d+)\s*\/\s*Atk\s*(\d+)\s*\/\s*Def\s*(\d+)\s*\/\s*SpA\s*(\d+)\s*\/\s*SpD\s*(\d+)\s*\/\s*Spe\s*(\d+)/i,
  );
  if (!spreadMatch) return null;

  const natureMatch = text.match(/Nature:\s*([A-Za-z]+)/i);
  const abilityMatch = text.match(/Ability:\s*([^\n]+)/i);
  const itemMatch = text.match(/Item:\s*([^\n]+)/i);
  const movesMatch = text.match(/Moves:\s*([^\n]+)/i);
  const reasoningMatch = text.match(/Reasoning:\s*([\s\S]+?)(?:\n\s*\n|$)/i);

  const spread: EVSpread = {
    hp: Math.min(perStatMax, parseInt(spreadMatch[1], 10)),
    atk: Math.min(perStatMax, parseInt(spreadMatch[2], 10)),
    def: Math.min(perStatMax, parseInt(spreadMatch[3], 10)),
    spa: Math.min(perStatMax, parseInt(spreadMatch[4], 10)),
    spd: Math.min(perStatMax, parseInt(spreadMatch[5], 10)),
    spe: Math.min(perStatMax, parseInt(spreadMatch[6], 10)),
  };

  const total =
    spread.hp + spread.atk + spread.def + spread.spa + spread.spd + spread.spe;
  if (total > totalMax) return null;

  const moves = (movesMatch?.[1] ?? "")
    .split(/\s*\/\s*/)
    .map((m) => m.trim())
    .filter(Boolean)
    .slice(0, 4);

  return {
    spread,
    nature: natureMatch?.[1]?.trim() ?? "Hardy",
    moves,
    ability: abilityMatch?.[1]?.trim() ?? "",
    item: itemMatch?.[1]?.trim() ?? "",
    reasoning: reasoningMatch?.[1]?.trim() ?? "Initial set proposal.",
  };
}

/**
 * Node: propose a full optimized set (Ability + Item + Moves + Nature +
 * Spread). Consumes the initial simulation results so the proposal can
 * target actual weaknesses shown by the benchmarks.
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

  // The initial simulation has already run. Show failures + sharpest
  // offensive coverage to ground the proposal.
  const initialSim = state.initialSimulationResults.length > 0
    ? state.initialSimulationResults
    : state.simulationResults;
  const failures = initialSim.filter((r) => !r.survives);
  const failureSummary = failures.length > 0
    ? failures.map((f) => `- vs ${f.threat}: ${f.damageRange} | ${f.speedComparison}`).join("\n")
    : "(all defensive checks currently pass — focus on offensive coverage and role consistency)";

  const userSpread = pokemon.evs;
  const userSet = `
User's current set (starting point — refine, don't throw away unless clearly wrong):
  Ability: ${pokemon.ability || "(unset)"}
  Item:    ${pokemon.item || "(unset)"}
  Moves:   ${pokemon.moves.filter(Boolean).join(" / ") || "(unset)"}
  Nature:  ${pokemon.nature || "Hardy"}
  Spread:  HP ${userSpread.hp} / Atk ${userSpread.atk} / Def ${userSpread.def} / SpA ${userSpread.spa} / SpD ${userSpread.spd} / Spe ${userSpread.spe}`;

  // Feedback from a previous iteration (we may loop up to maxIterations).
  let feedbackSection = "";
  if (state.iterations > 0) {
    feedbackSection = `\nPREVIOUS ITERATION FEEDBACK:`;
    if (state.wolfeReview) feedbackSection += `\nWolfe said: ${state.wolfeReview}`;
    if (state.cybertronReview) feedbackSection += `\nCybertron said: ${state.cybertronReview}`;
    feedbackSection += `\nAdjust the set to address the above.`;
  }

  const systemPrompt = `You are the Spread Specialist, an expert at building full VGC doubles sets${isChampions ? " for Pokemon Champions Regulation M-A" : ""}.

Your job: propose a complete, optimized set — Ability, Item, Moves (exactly 4, unique), Nature, and ${label}.

HARD RULES:
- The Nature MUST match the actual offensive category of the moves. Physical attackers get Adamant/Jolly, Special attackers get Modest/Timid, Supports get Bold/Calm/Careful/Relaxed/Sassy.
- Moves: exactly 4, no duplicates, must make sense for the Pokemon's role. If it's a special attacker, prefer special STAB + coverage. Physical attackers prefer physical moves. Include Protect on bulky pivots.
- Ability: pick the one that best synergizes with the team strategy (Swift Swim on rain, Chlorophyll on sun, Stamina on Archaludon for bulk, Intimidate on Incineroar, etc.).
- Item: pick for role (Focus Sash on frail leads, Leftovers on passive bulk, Assault Vest on special-bulky offense, Choice Scarf for speed control, Mega Stone if mega-evolving).
${isChampions ? `- ${label}: total must equal exactly ${totalMax}, max ${perStatMax} per stat. Spread across 3-5 stats. 1 Champions point = 8 traditional EVs.` : `- ${label}: total must equal exactly ${totalMax}, max ${perStatMax} per stat. Spread across 3-5 stats.`}
- Consider teammate coverage — don't duplicate roles that teammates already provide.`;

  // Pull verified tournament/creator sets for this species from
  // meta_teams (Limitless top-cut + VGCPastes + creator entries).
  // Anchoring the proposer in real tournament data is what stops it
  // from inventing nonsense moves like "Knock Off on Incineroar".
  const referenceSets = getReferenceSetsForSpecies(pokemon.species, format, 6);
  const referenceBlock = formatReferenceSetsBlock(referenceSets);

  const userPrompt = `Pokemon: ${pokemon.species}
${userSet}

Initial benchmark simulation (what the user's current set produces):
${failureSummary}

Teammates on this team:
${teammates || "  • (none yet)"}

Top meta threats in this format (defensive benchmarks should target these): ${threatList}

REFERENCE SETS — verified tournament/creator builds for ${pokemon.species} (highest trust first):
${referenceBlock}

Use these reference sets as your starting point. Copy moves/item/ability/nature when they make sense for the team — every move that appears in 2+ tournament sets is presumed legal AND viable. Deviate ONLY if you can name a specific reason the team needs something different (and cite that reason in Reasoning). Never invent a move that isn't in any reference set unless you're absolutely sure of its competitive history for this species.
${feedbackSection}

Respond with EXACTLY this format (and nothing else):
Ability: <ability name>
Item: <item name>
Moves: Move1 / Move2 / Move3 / Move4
Nature: <NatureName>
Spread: HP <n> / Atk <n> / Def <n> / SpA <n> / SpD <n> / Spe <n>
Reasoning: <2-3 sentences. If you copied a reference set, name the source (e.g. "Wolfe Glick creator entry"). If you deviated, justify the change.>`;

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

  const parsed = parseSetFromResponse(text, totalMax, perStatMax);

  if (parsed) {
    const paddedMoves = [...parsed.moves, "", "", "", ""].slice(0, 4);
    return {
      currentSpread: parsed.spread,
      currentNature: parsed.nature,
      currentMoves: paddedMoves,
      currentAbility: parsed.ability || pokemon.ability,
      currentItem: parsed.item || pokemon.item,
      spreadHistory: [
        {
          spread: parsed.spread,
          nature: parsed.nature,
          moves: paddedMoves,
          ability: parsed.ability,
          item: parsed.item,
          source: "spread_specialist",
          reasoning: parsed.reasoning,
        },
      ],
      iterations: state.iterations + 1,
    };
  }

  // Fallback: keep the user's current set.
  return {
    currentSpread: pokemon.evs,
    currentNature: pokemon.nature,
    currentMoves: [...pokemon.moves],
    currentAbility: pokemon.ability,
    currentItem: pokemon.item,
    spreadHistory: [
      {
        spread: pokemon.evs,
        nature: pokemon.nature,
        moves: [...pokemon.moves],
        ability: pokemon.ability,
        item: pokemon.item,
        source: "spread_specialist",
        reasoning: "Fallback: LLM response could not be parsed.",
      },
    ],
    iterations: state.iterations + 1,
  };
}
