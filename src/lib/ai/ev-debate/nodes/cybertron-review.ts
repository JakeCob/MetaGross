import type { EVDebateStateType, EVDebateStateUpdate } from "../state";
import { createModel, detectProvider } from "@/lib/ai/graph/model";
import { AGENT_PERSONAS } from "@/lib/types/agent";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { CHAMPIONS_POINTS } from "@/lib/data/champions";
import {
  getReferenceSetsForSpecies,
  formatReferenceSetsBlock,
} from "@/lib/meta-teams/species-sets";

/**
 * Node: CybertronVGC (Aaron Zheng) reviews the current spread from a
 * methodical/fundamental perspective, also considering Wolfe's input.
 */
export async function cybertronReviewNode(
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
    simulationResults,
    wolfeReview,
    format,
  } = state;
  const isChampions = format.toLowerCase().startsWith("champions");
  const totalMax = isChampions ? CHAMPIONS_POINTS.totalMax : 510;
  const perStatMax = isChampions ? CHAMPIONS_POINTS.perStatMax : 252;

  const persona = AGENT_PERSONAS.cybertron;
  const spreadStr = `HP ${currentSpread.hp} / Atk ${currentSpread.atk} / Def ${currentSpread.def} / SpA ${currentSpread.spa} / SpD ${currentSpread.spd} / Spe ${currentSpread.spe}`;
  const movesStr = (currentMoves ?? [])
    .filter(Boolean)
    .join(" / ") || pokemon.moves.filter(Boolean).join(" / ");

  const teammates = team
    .filter((t) => t.species && t.species !== pokemon.species)
    .map(
      (t) =>
        `${t.species} (${t.ability || "?"}${t.item ? `, ${t.item}` : ""}${
          (t.moves ?? []).filter(Boolean).length
            ? `, moves=${(t.moves ?? []).filter(Boolean).join("/")}`
            : ""
        })`,
    )
    .join("\n  • ");

  const simSnapshot = simulationResults
    .slice(0, 10)
    .map((r) => `- ${r.survives ? "OK" : "FAIL"} vs ${r.threat}: ${r.damageRange}, ${r.speedComparison}`)
    .join("\n");

  const systemPrompt = `${persona.systemPromptAddition} You are reviewing the WHOLE set — Ability, Item, Moves, Nature, and ${isChampions ? "stat points" : "EVs"} — not just the numbers. Keep it to 3-5 sentences. Focus on survival benchmarks${isChampions ? " against Champions Reg M-A threats (Sneasler, Archaludon, Kingambit, Garchomp, Dragonite-Mega, Tyranitar-Mega, Charizard-Mega-Y)" : ""}, defensive calcs, and fundamental consistency. Flag Nature/moveset mismatches and weak item/ability choices explicitly.`;

  const referenceSets = await getReferenceSetsForSpecies(pokemon.species, format, 6);
  const referenceBlock = formatReferenceSetsBlock(referenceSets);

  const userPrompt = `Review this full set for ${pokemon.species}:
  Ability: ${currentAbility || pokemon.ability}
  Item:    ${currentItem || pokemon.item}
  Moves:   ${movesStr}
  Nature:  ${currentNature}
  Spread:  ${spreadStr}
Max total: ${totalMax}, max per stat: ${perStatMax}.

Teammates on the team:
  • ${teammates || "(none)"}

Fresh benchmark simulation vs the format's top meta threats:
${simSnapshot || "(no sim data)"}

VERIFIED TOURNAMENT/CREATOR REFERENCE SETS for ${pokemon.species}:
${referenceBlock}

Wolfe Glick said: "${wolfeReview ?? "No comment yet."}"

Do you agree or disagree with Wolfe? What would you change across Ability, Item, Moves, Nature, and spread? Be specific about survival calcs, cite the sim, consider teammate coverage, AND cross-check the proposed set against the reference sets — if a move/item/ability isn't in any reference set, that's a strong signal something is off.`;

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
