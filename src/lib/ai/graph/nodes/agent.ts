import type { AgentStateType, AgentStateUpdate } from "../state";
import type { AgentPersona } from "@/lib/types/agent";
import { AGENT_PERSONAS } from "@/lib/types/agent";
import { allTools } from "@/lib/ai/tools";
import { createModel, detectProvider, getModelName } from "../model";
import type { BaseMessage } from "@langchain/core/messages";
import { SystemMessage } from "@langchain/core/messages";
import { logAgentEvent } from "@/lib/ai/logger";

const BASE_SYSTEM_PROMPT = `You are MetaGross, an expert Pokemon VGC doubles copilot for Champions Regulation M-A.

CHAMPIONS STAT POINTS: 66 total, 32 max per stat. NOT EVs (not 510/252).

RULES:
1. Call get_pokemon_competitive_sets for EVERY Pokemon — never guess abilities, moves, or items.
2. Call optimize_ev_spread for EVERY Pokemon. COPY THE RETURNED SPREAD EXACTLY — do NOT make up your own spread. The tool runs Wolfe Glick + CybertronVGC debate with damage calcs. Trust its output.
3. The nature from optimize_ev_spread must match the role: Special attackers get Modest/Timid, Physical attackers get Adamant/Jolly, Supports get Bold/Calm/Careful. If the tool returns a mismatched nature, fix it.
4. ~187 Pokemon available. No Legendaries/Paradox/Amoonguss/Rillaboom/Kingdra. No Tera. Mega via Mega Stones (no Mega Metagross/Salamence). IVs fixed at 31.
5. ALWAYS suggest exactly 6 Pokemon for a team.
6. For write actions, use write tools (user must approve).

OUTPUT FORMAT — each Pokemon MUST use this exact template:

### Pokemon Name
- **Role**: Role description
- **Ability**: (from Pikalytics) Why this ability
- **Item**: (from confirmed items) Why this item
- **Nature**: NatureName — explain why (e.g., Modest for special attacker)
- **Moves**: Move1 / Move2 / Move3 / Move4 — brief note on each move's purpose
- **Points**: HP X / Atk X / Def X / SpA X / SpD X / Spe X (COPY FROM optimize_ev_spread tool result)
- **Spread Reasoning**: (COPY FROM optimize_ev_spread reasoning + wolfe/cybertron comments)

CRITICAL: Copy the Points line EXACTLY from the optimize_ev_spread tool result. Do NOT modify it. Do NOT invent your own spread.
Verify: nature matches role (Modest/Timid for special, Adamant/Jolly for physical, Bold/Calm for support). Stats invest in the RIGHT offensive stat (SpA for special, Atk for physical).

Every ### heading must be a Pokemon species name. No "Additional Team Members" headings.
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

  const startTime = Date.now();
  const response = await modelWithTools.invoke(allMessages);
  const durationMs = Date.now() - startTime;

  // Log the LLM call
  const tokenUsage = response.usage_metadata;
  logAgentEvent({
    sessionId: state.threadId || "unknown",
    agent: "metagross-main",
    node: "agent",
    model: getModelName(provider),
    provider,
    action: "llm_call",
    inputTokens: tokenUsage?.input_tokens ?? 0,
    outputTokens: tokenUsage?.output_tokens ?? 0,
    durationMs,
    output: typeof response.content === "string"
      ? response.content.slice(0, 300)
      : Array.isArray(response.content)
        ? JSON.stringify(response.content).slice(0, 300)
        : "",
  });

  return { messages: [response] };
}
