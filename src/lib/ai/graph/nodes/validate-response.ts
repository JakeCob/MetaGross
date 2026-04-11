import type { AgentStateType, AgentStateUpdate } from "../state";
import { isChampionsPokemon, isConfirmedNotInChampions, CHAMPIONS_ITEMS_CONFIRMED, CHAMPIONS_ITEMS_UNCERTAIN } from "@/lib/data/champions";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import { createModel, detectProvider } from "../model";

/**
 * Validation node that checks the agent's response for accuracy issues
 * BEFORE it reaches the user. If problems are found, it sends the response
 * back to the agent with correction instructions.
 */
export async function validateResponseNode(
  state: AgentStateType,
): Promise<Partial<AgentStateUpdate>> {
  const messages = state.messages ?? [];
  const lastMsg = messages[messages.length - 1];

  if (!lastMsg || lastMsg._getType() !== "ai") {
    return {};
  }

  const aiMsg = lastMsg as AIMessage;

  // Skip validation if there are tool calls (agent is still working)
  if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
    return {};
  }

  const content = typeof aiMsg.content === "string"
    ? aiMsg.content
    : Array.isArray(aiMsg.content)
      ? aiMsg.content
          .filter((b): b is { type: "text"; text: string } =>
            typeof b === "object" && b !== null && "type" in b && b.type === "text")
          .map((b) => b.text)
          .join("")
      : "";

  if (!content) return {};

  // Check for common hallucination patterns
  const issues: string[] = [];

  // Check for Pokemon not in Champions
  const pokemonMentions = content.match(/###\s+([A-Z][a-z]+(?:-[A-Za-z]+)?)/g);
  if (pokemonMentions) {
    for (const match of pokemonMentions) {
      const species = match.replace(/^###\s+/, "").trim();
      if (isConfirmedNotInChampions(species)) {
        issues.push(`${species} is NOT available in Champions Reg M-A. Remove it and suggest an alternative.`);
      }
    }
  }

  // Check for uncertain items being recommended
  const uncertainItems = CHAMPIONS_ITEMS_UNCERTAIN;
  for (const item of uncertainItems) {
    if (content.includes(item)) {
      const confirmedAlternative = CHAMPIONS_ITEMS_CONFIRMED.find(i =>
        i.includes("Berry") || i === "Focus Sash" || i === "Safety Goggles"
      );
      issues.push(`${item} may NOT be available in Champions (unverified). Suggest a confirmed alternative like ${confirmedAlternative}.`);
    }
  }

  // Check for known wrong abilities
  const wrongAbilities: Record<string, string[]> = {
    "Archaludon": ["Levitate"],
    "Incineroar": ["Blaze"],
    "Pelipper": ["Keen Eye", "Rain Dish"],
  };
  for (const [species, badAbilities] of Object.entries(wrongAbilities)) {
    for (const bad of badAbilities) {
      if (content.includes(species) && content.includes(`**Ability**: ${bad}`)) {
        issues.push(`${species} should NOT use ${bad} in competitive VGC. Check get_pokemon_competitive_sets for the correct ability.`);
      }
    }
  }

  // Check stat point totals (must equal 66, max 32 per stat)
  const pointMatches = content.matchAll(/\*\*Points\*\*:\s*HP\s*(\d+)\s*\/\s*Atk\s*(\d+)\s*\/\s*Def\s*(\d+)\s*\/\s*SpA\s*(\d+)\s*\/\s*SpD\s*(\d+)\s*\/\s*Spe\s*(\d+)/g);
  for (const match of pointMatches) {
    const stats = [1, 2, 3, 4, 5, 6].map((i) => parseInt(match[i]));
    const total = stats.reduce((sum, v) => sum + v, 0);
    const maxStat = Math.max(...stats);
    if (maxStat > 32) {
      issues.push(`A Pokemon has a stat at ${maxStat} points — maximum is 32 per stat. Reduce it to 32 and redistribute the excess to other stats.`);
    }
    if (total !== 66) {
      issues.push(`A Pokemon has ${total}/66 stat points. Redistribute to use EXACTLY 66 points total. Consider spreading points across more stats based on survival benchmarks instead of just maxing 2 stats.`);
    }
  }

  // Check if fewer than 6 Pokemon were suggested when it looks like a team
  if (content.includes("### ") && pokemonMentions && pokemonMentions.length < 6) {
    const count = pokemonMentions.length;
    if (content.toLowerCase().includes("team") || state.messages.some(m =>
      typeof m.content === "string" && m.content.toLowerCase().includes("team")
    )) {
      issues.push(`Only ${count} Pokemon were suggested. A VGC team needs exactly 6 Pokemon. Add ${6 - count} more to complete the team.`);
    }
  }

  if (issues.length === 0) {
    return {}; // No issues, response is fine
  }

  // Issues found — ask the agent to fix its response
  const correctionPrompt = `VALIDATION FAILED. Fix these issues in your response before it reaches the user:

${issues.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}

Regenerate your COMPLETE response with these corrections. Use get_pokemon_competitive_sets to verify any uncertain data. Do NOT apologize for the errors — just provide the corrected response.`;

  const provider = detectProvider();
  const model = createModel(provider);

  const correctionMessages = [
    ...state.messages,
    new SystemMessage(correctionPrompt),
  ];

  const response = await model.invoke(correctionMessages);

  // Replace the last AI message with the corrected one
  return {
    messages: [response],
  };
}
