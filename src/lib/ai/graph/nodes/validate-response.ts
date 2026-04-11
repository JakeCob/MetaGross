import type { AgentStateType, AgentStateUpdate } from "../state";
import { isChampionsPokemon, isConfirmedNotInChampions, CHAMPIONS_ITEMS_CONFIRMED, CHAMPIONS_ITEMS_UNCERTAIN } from "@/lib/data/champions";
import { AIMessage, SystemMessage, RemoveMessage } from "@langchain/core/messages";
import { createModel, detectProvider, getModelName } from "../model";
import { logAgentEvent } from "@/lib/ai/logger";

/**
 * Validation node that checks the agent's response for accuracy issues
 * BEFORE it reaches the user. If problems are found, it REPLACES the
 * response with a corrected version (removes the bad one, adds the fix).
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

  const issues: string[] = [];

  // Check for Pokemon not in Champions
  const pokemonMentions = content.match(/###\s+([A-Z][a-z]+(?:[- ][A-Za-z]+)?)/g);
  if (pokemonMentions) {
    for (const match of pokemonMentions) {
      const species = match.replace(/^###\s+/, "").trim();
      if (isConfirmedNotInChampions(species)) {
        issues.push(`${species} is NOT available in Champions Reg M-A. Remove it and suggest an alternative.`);
      }
    }
  }

  // Check for uncertain items being recommended
  for (const item of CHAMPIONS_ITEMS_UNCERTAIN) {
    if (content.includes(item)) {
      issues.push(`${item} may NOT be available in Champions (unverified). Suggest a confirmed alternative.`);
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
        issues.push(`${species} should NOT use ${bad} in competitive VGC. Use the correct competitive ability.`);
      }
    }
  }

  // Check stat point totals (must equal 66, max 32 per stat)
  // Also catch if the model output EVs (252/510) instead of Points (32/66)
  const pointMatches = content.matchAll(/\*\*(?:Points|EVs)\*\*:\s*HP\s*(\d+)\s*\/\s*Atk\s*(\d+)\s*\/\s*Def\s*(\d+)\s*\/\s*SpA\s*(\d+)\s*\/\s*SpD\s*(\d+)\s*\/\s*Spe\s*(\d+)/g);
  for (const match of pointMatches) {
    const stats = [1, 2, 3, 4, 5, 6].map((i) => parseInt(match[i]));
    const total = stats.reduce((sum, v) => sum + v, 0);
    const maxStat = Math.max(...stats);

    // Detect if model used traditional EVs (252/510) instead of Champions Points (32/66)
    if (total > 100 || maxStat > 32) {
      issues.push(
        `WRONG SYSTEM: You used traditional EVs (total=${total}, max=${maxStat}). Champions uses STAT POINTS: 66 total, 32 max per stat. COPY the spread from the optimize_ev_spread tool result EXACTLY.`
      );
      break;
    }

    if (total !== 66) {
      issues.push(`A Pokemon has ${total}/66 stat points. Must be EXACTLY 66. COPY the spread from the optimize_ev_spread tool result.`);
    }
  }

  // Check for nature/stat mismatches (e.g., Adamant with max SpA, or special attacker with max Atk)
  const pokemonSections = content.split(/(?=^### )/m).filter((s) => s.startsWith("### "));
  for (const section of pokemonSections) {
    const natureMatch = section.match(/\*\*Nature\*\*:\s*(\w+)/);
    const pointsMatch = section.match(/\*\*Points\*\*:\s*HP\s*(\d+)\s*\/\s*Atk\s*(\d+)\s*\/\s*Def\s*(\d+)\s*\/\s*SpA\s*(\d+)\s*\/\s*SpD\s*(\d+)\s*\/\s*Spe\s*(\d+)/);
    const roleMatch = section.match(/\*\*Role\*\*:\s*(.+)/);
    const speciesMatch = section.match(/^### (.+)/);

    if (natureMatch && pointsMatch && roleMatch && speciesMatch) {
      const nature = natureMatch[1];
      const atk = parseInt(pointsMatch[2]);
      const spa = parseInt(pointsMatch[4]);
      const role = roleMatch[1].toLowerCase();
      const species = speciesMatch[1].trim();

      const isSpecialRole = role.includes("special") || role.includes("rain setter");
      const isPhysicalRole = role.includes("physical");

      // Special attacker with Adamant (boosts Atk, reduces SpA) and max Atk = wrong
      if (isSpecialRole && (nature === "Adamant" || nature === "Jolly") && atk > spa) {
        issues.push(`${species}: ${nature} nature with ${atk} Atk is wrong for a special attacker. Use Modest/Timid and invest in SpA, not Atk. COPY the spread from optimize_ev_spread.`);
      }
      // Physical attacker with Modest (boosts SpA, reduces Atk) and max SpA = wrong
      if (isPhysicalRole && (nature === "Modest" || nature === "Timid") && spa > atk) {
        issues.push(`${species}: ${nature} nature with ${spa} SpA is wrong for a physical attacker. Use Adamant/Jolly and invest in Atk, not SpA.`);
      }
    }
  }

  // Check if fewer than 6 Pokemon were suggested when it looks like a team
  if (pokemonMentions && pokemonMentions.length < 6) {
    const isTeamRequest = state.messages.some(m =>
      typeof m.content === "string" && m.content.toLowerCase().includes("team")
    );
    if (isTeamRequest) {
      issues.push(`Only ${pokemonMentions.length} Pokemon suggested. A VGC team needs exactly 6. Add ${6 - pokemonMentions.length} more.`);
    }
  }

  if (issues.length === 0) {
    logAgentEvent({
      sessionId: state.threadId || "unknown",
      agent: "metagross-main",
      node: "validate",
      model: getModelName(detectProvider()),
      provider: detectProvider(),
      action: "validation",
      metadata: { passed: true, issueCount: 0 },
    });
    return {}; // No issues, response is fine
  }

  // Log validation failures
  logAgentEvent({
    sessionId: state.threadId || "unknown",
    agent: "metagross-main",
    node: "validate",
    model: getModelName(detectProvider()),
    provider: detectProvider(),
    action: "validation",
    metadata: { passed: false, issues },
  });

  // Issues found — regenerate a corrected response and REPLACE the bad one
  const correctionPrompt = `VALIDATION FAILED. Fix these issues and regenerate the COMPLETE response:

${issues.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}

Output the corrected FULL response. Do NOT repeat or reference the previous attempt.`;

  const provider = detectProvider();
  const model = createModel(provider);

  const correctionMessages = [
    ...state.messages,
    new SystemMessage(correctionPrompt),
  ];

  const correctedResponse = await model.invoke(correctionMessages);

  // REMOVE the bad message, then ADD the corrected one
  // This prevents duplication in the stream
  const removeMsg = new RemoveMessage({ id: aiMsg.id! });

  return {
    messages: [removeMsg, correctedResponse],
  };
}
