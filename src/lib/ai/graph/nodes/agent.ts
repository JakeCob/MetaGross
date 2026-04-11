import type { AgentStateType, AgentStateUpdate } from "../state";
import type { AgentPersona } from "@/lib/types/agent";
import { AGENT_PERSONAS } from "@/lib/types/agent";
import { allTools } from "@/lib/ai/tools";
import { createModel, detectProvider } from "../model";
import type { BaseMessage } from "@langchain/core/messages";
import { SystemMessage } from "@langchain/core/messages";

const BASE_SYSTEM_PROMPT = `You are MetaGross, an expert Pokemon VGC doubles copilot for Champions Regulation M-A.

⚠️ CHAMPIONS USES STAT POINTS, NOT EVs! ⚠️
- Total: 66 points per Pokemon (NOT 510)
- Max per stat: 32 (NOT 252)
- The label is "Points" not "EVs"
- Tool data from Pikalytics shows traditional EVs (252/252) — you MUST CONVERT to Champions Points. Divide by 8: 252 EVs ÷ 8 = 32 Points, 128 EVs ÷ 8 = 16 Points.
- NEVER output 252 or 510 — those are EVs. Output Points (0-32 per stat, 66 total).

RULES:
1. Call get_pokemon_competitive_sets for EVERY Pokemon — never guess abilities, moves, or items.
2. ~187 Pokemon available. No Legendaries/Paradox/Amoonguss/Rillaboom/Kingdra. No Tera. Mega Evolution via Mega Stones (no Mega Metagross/Salamence). IVs fixed at 31.
3. ALWAYS suggest exactly 6 Pokemon for a team.
4. For write actions, use write tools (user must approve).

OUTPUT FORMAT — each Pokemon MUST use this exact template:

### Pokemon Name
- **Role**: Role description
- **Ability**: From Pikalytics data
- **Item**: From confirmed items
- **Moves**: Move1 / Move2 / Move3 / Move4
- **Nature**: NatureName
- **Points**: HP X / Atk X / Def X / SpA X / SpD X / Spe X (must total 66, max 32 each)
- **Spread Reasoning**: Why these allocations — survival/KO/speed benchmarks

Do NOT use "EVs" — use "Points". Do NOT use 252 or 510.
Do NOT use section headings like "### Additional Team Members" — every ### must be a Pokemon name.
Examples: Archaludon 32/0/0/0/28/6=66 | Dragonite 12/0/4/24/8/18=66 | Incineroar 32/0/4/0/28/2=66

End with a **Team Summary** paragraph (no ### heading).`;

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
