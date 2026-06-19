import type { EVDebateStateType, EVDebateStateUpdate } from "../state";
import { createModel, detectProvider } from "@/lib/ai/graph/model";
import { AGENT_PERSONAS } from "@/lib/types/agent";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { CHAMPIONS_POINTS, ACTIVE_REGULATION_LABEL } from "@/lib/data/champions";
import {
  getReferenceSetsForSpecies,
  formatReferenceSetsBlock,
} from "@/lib/meta-teams/species-sets";

/**
 * Node: Wolfe Glick reviews the current spread from an aggressive/creative
 * perspective. Suggests modifications and explains reasoning.
 */
export async function wolfeReviewNode(
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
    format,
  } = state;
  const isChampions = format.toLowerCase().startsWith("champions");
  const totalMax = isChampions ? CHAMPIONS_POINTS.totalMax : 510;
  const perStatMax = isChampions ? CHAMPIONS_POINTS.perStatMax : 252;

  const persona = AGENT_PERSONAS.wolfe_glick;
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

  const systemPrompt = `${persona.systemPromptAddition} You are reviewing the WHOLE set — Ability, Item, Moves, Nature, and ${isChampions ? "stat points" : "EVs"} — not just the numbers. Keep it to 3-5 sentences. Focus on speed tiers, offensive benchmarks${isChampions ? ` against ${ACTIVE_REGULATION_LABEL} threats` : ""}, role coherence (the Nature must match move categories), teammate synergy, and creative adjustments. If an ability, item, or move choice is wrong for the role, say so explicitly.`;

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

What would you keep or change — across Ability, Item, Moves, Nature, and the spread — and why? Compare the proposed set to the reference sets above:
- If the proposed Move/Item/Ability appears in 2+ reference sets, it's likely correct.
- If a move ISN'T in any reference set, call it out as suspicious and suggest a replacement that IS in the references.
- Cite specific benchmarks from the sim and teammate overlap/synergy.
- Flag any clear mismatch (Adamant on a fully-special set, Focus Sash on a Mega-evolving Pokemon, etc.).`;

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
