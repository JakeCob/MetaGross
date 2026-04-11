import type { AgentStateType, AgentStateUpdate } from "../state";
import type { AgentPersona } from "@/lib/types/agent";
import { AGENT_PERSONAS } from "@/lib/types/agent";
import { allTools } from "@/lib/ai/tools";
import { createModel, detectProvider } from "../model";
import type { BaseMessage } from "@langchain/core/messages";
import { SystemMessage } from "@langchain/core/messages";

const BASE_SYSTEM_PROMPT = `You are MetaGross, an expert AI copilot for competitive Pokemon VGC (Video Game Championships) doubles battles.

CRITICAL RULES — FOLLOW THESE EXACTLY:

1. ALWAYS USE TOOLS BEFORE ANSWERING. You MUST call at least one tool before providing any recommendation. Never rely on your training data alone — it may be outdated or wrong.
   - Before suggesting Pokemon: call get_meta_data or search_web to check what's actually viable and available in the current format.
   - Before suggesting moves/items: call get_meta_data to see what moves and items are actually used in competitive play for that Pokemon.
   - Before damage claims: call calculate_damage.
   - Before speed claims: call check_speed.

2. The current format is Pokemon Champions Regulation M-A. This is a NEW game released April 2026 with:
   - A DIFFERENT Pokemon pool than Scarlet/Violet — many Pokemon are NOT available
   - A DIFFERENT item pool — not all items from mainline games exist
   - A Point system instead of EVs: 66 total points, 32 max per stat
   - Mega Evolution is available via Mega Stones
   - If you're unsure whether a Pokemon/item/move exists in Champions, use search_web to verify BEFORE recommending it.

3. When building teams:
   - Use get_meta_data to check actual usage statistics and common sets
   - Use search_web to verify Pokemon/item availability in Champions if unsure
   - Recommend moves and items that are ACTUALLY USED in competitive Champions play, not theoretical picks
   - Check common teammates data to suggest synergy picks

4. When proposing changes to teams or match notes, use write tools. Write tools create proposals the user must approve.

5. Be concise and tactical. Format in clean markdown. No filler.`;

/**
 * Build the full system prompt from base + persona + context + memory.
 */
function buildSystemPrompt(state: AgentStateType): string {
  const parts: string[] = [BASE_SYSTEM_PROMPT];

  // Add persona-specific instructions
  const personaKey = (state.persona || "default") as AgentPersona;
  const persona = AGENT_PERSONAS[personaKey] ?? AGENT_PERSONAS.default;
  parts.push(`\n\nPersona: ${persona.displayName}\n${persona.systemPromptAddition}`);

  // Add loaded context summary
  if (state.loadedContext) {
    const ctx = state.loadedContext;
    if (ctx.type === "match") {
      parts.push(`\n\nCurrent context: Match analysis`);
      parts.push(`- Format: ${ctx.format || "unknown"}`);
      parts.push(`- Result: ${ctx.result || "unknown"}`);
      if (ctx.opponentName) parts.push(`- Opponent: ${ctx.opponentName}`);
      if (ctx.archetypeSelf) parts.push(`- My archetype: ${ctx.archetypeSelf}`);
      if (ctx.archetypeOpponent) parts.push(`- Opponent archetype: ${ctx.archetypeOpponent}`);
      if (ctx.turnCount) parts.push(`- Turns played: ${ctx.turnCount}`);
      parts.push(`\nYou have access to the full match data via the get_match_context tool. Use it for detailed analysis.`);
    } else if (ctx.type === "team") {
      parts.push(`\n\nCurrent context: Team "${ctx.name || "unnamed"}"`);
      parts.push(`- Format: ${ctx.format || "unknown"}`);
      if (Array.isArray(ctx.pokemon)) {
        const species = (ctx.pokemon as { species: string }[]).map((p) => p.species).join(", ");
        parts.push(`- Pokemon: ${species}`);
      }
      parts.push(`\nYou have access to the full team data via the get_team tool.`);
    }
  }

  // Add memory hits
  if (state.memoryHits && state.memoryHits.length > 0) {
    parts.push(`\n\nThings I remember about this user:`);
    for (const mem of state.memoryHits) {
      parts.push(`- ${mem}`);
    }
  }

  return parts.join("\n");
}

/**
 * Graph node: the main LLM reasoning step.
 * Builds the system prompt, binds tools, and invokes the model.
 */
export async function agentNode(
  state: AgentStateType,
): Promise<Partial<AgentStateUpdate>> {
  const provider = detectProvider();
  const model = createModel(provider);

  const systemPrompt = buildSystemPrompt(state);

  // Bind all tools (read + write) to the model
  const modelWithTools = model.bindTools(allTools);

  // Build messages array: system + conversation history
  const allMessages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    ...state.messages,
  ];

  const response = await modelWithTools.invoke(allMessages);

  return { messages: [response] };
}
