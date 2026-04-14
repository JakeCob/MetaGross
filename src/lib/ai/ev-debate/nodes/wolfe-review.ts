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

  const systemPrompt = `${persona.systemPromptAddition} You are reviewing the WHOLE set — Ability, Item, Moves, Nature, and ${isChampions ? "stat points" : "EVs"} — not just the numbers. Keep it to 3-5 sentences. Focus on speed tiers, offensive benchmarks${isChampions ? " against Champions Reg M-A threats" : ""}, role coherence (the Nature must match move categories), teammate synergy, and creative adjustments. If an ability, item, or move choice is wrong for the role, say so explicitly.`;

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

What would you keep or change — across Ability, Item, Moves, Nature, and the spread — and why? Cite specific benchmarks from the sim and call out teammate overlap/synergy. Flag any clear mismatch (e.g., Adamant on a fully-special set, Focus Sash on a Mega-evolving Pokemon).`;

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
