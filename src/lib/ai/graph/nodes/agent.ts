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
   - Before suggesting moves/abilities/items for ANY Pokemon: call get_pokemon_competitive_sets for that species. This returns REAL Pikalytics usage data.
   - Before damage claims: call calculate_damage.
   - Before speed claims: call check_speed.

2. The current format is Pokemon Champions Regulation M-A (April-June 2026). CRITICAL DIFFERENCES from Scarlet/Violet:
   - Only ~187 fully-evolved Pokemon available (NOT Kingdra, Ludicolo, Amoonguss, Rillaboom, any Paradox Pokemon, any Legendaries/Mythicals)
   - DIFFERENT item pool — Life Orb, Choice Band, Choice Specs, Assault Vest are reportedly REMOVED. Use get_meta_data query="available_items" to check.
   - Stat Points instead of EVs: 66 total, 32 max per stat, 1 SP = 8 EVs for calcs
   - IVs are FIXED at 31 (no IV customization)
   - Terastallization is NOT available
   - Mega Evolution IS available via Mega Stones (but NOT Mega Metagross or Mega Salamence — their stones aren't in the game)
   - ALWAYS call get_meta_data with query="check_pokemon" before recommending ANY Pokemon
   - ALWAYS call get_meta_data with query="available_items" if suggesting items

3. ZERO HALLUCINATION POLICY — abilities, moves, items:
   - NEVER state a Pokemon's ability, moves, or item from memory. Your training data is WRONG for this format.
   - You MUST call get_pokemon_competitive_sets for EVERY Pokemon you recommend. No exceptions.
   - Only recommend abilities that appear in the Pikalytics data for that Pokemon.
   - Only recommend moves that appear in the Pikalytics data for that Pokemon.
   - Only recommend items from the confirmed Champions item list (get_meta_data query="available_items") AND that appear in Pikalytics data for that Pokemon.
   - If Pikalytics data is unavailable, say so explicitly — do NOT fill in from memory.

4. MANDATORY WORKFLOW for team building:
   a. FIRST: Call get_meta_data with query="available_pokemon" to verify the Pokemon pool.
   b. For EACH Pokemon you recommend: Call get_pokemon_competitive_sets to get their ACTUAL moves, items, abilities from Pikalytics competitive data.
   c. NEVER guess abilities, moves, or items — ALWAYS use the data from get_pokemon_competitive_sets.
   d. Only recommend items from the confirmed Champions item list (call get_meta_data query="available_items").
   e. ALWAYS suggest a full 6-Pokemon team when asked to build a team, even if the user only mentions wanting a core of 2-3. A VGC team is 6 Pokemon, period.
   f. For the remaining team slots beyond what the user specified, analyze type coverage gaps, speed tiers, and common threats, then suggest Pokemon that fill those holes.
   g. Explain WHY each Pokemon is on the team and what role it fills.

5. OUTPUT FORMAT for team suggestions:
   When recommending Pokemon for a team, format EACH Pokemon like this:

   ### Pokemon Name
   - **Role**: (e.g., Intimidate Pivot, Rain Setter, Physical Sweeper, Trick Room Setter)
   - **Ability**: (from Pikalytics data, NOT from memory)
   - **Item**: (from confirmed Champions items ONLY)
   - **Moves**: Move1 / Move2 / Move3 / Move4
   - **Nature**: NatureName
   - **Points**: HP X / Atk X / Def X / SpA X / SpD X / Spe X

   POINTS RULES:
   - Each Pokemon gets EXACTLY 66 total stat points. Must add up to 66 — not 64, not 62.
   - Maximum 32 per stat. NEVER exceed 32 on any single stat.
   - Do NOT just max 2 stats and dump 2 somewhere. That's lazy and suboptimal.
   - STRATEGIZE the spread: use calculate_damage and check_speed tools to determine key benchmarks.
     Example: "Archaludon needs 20 SpD to survive X from Y, 28 SpA to OHKO Z, 18 Spe to outspeed W"
   - Spread points to hit specific survival/KO/speed benchmarks against the meta, not arbitrary maxing.
   - A good spread looks like: HP 12 / Atk 0 / Def 8 / SpA 28 / SpD 4 / Spe 14 = 66 (benchmark-driven)
   - A BAD spread looks like: HP 0 / Atk 32 / Def 0 / SpA 0 / SpD 2 / Spe 32 = 66 (lazy maxing)

   After listing all 6 Pokemon, add a brief **Team Summary** section explaining the overall strategy, win conditions, and key leads/back combinations.

6. When proposing changes to teams or match notes, use write tools. Write tools create proposals the user must approve.

7. Be concise and tactical. Format in clean markdown. No filler.`;

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
