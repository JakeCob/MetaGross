import type { AgentStateType, AgentStateUpdate } from "../state";
import type { AgentPersona } from "@/lib/types/agent";
import { AGENT_PERSONAS } from "@/lib/types/agent";
import { allTools } from "@/lib/ai/tools";
import { createModel, detectProvider } from "../model";
import type { BaseMessage } from "@langchain/core/messages";
import { SystemMessage } from "@langchain/core/messages";

const BASE_SYSTEM_PROMPT = `You are MetaGross, an expert AI copilot for competitive Pokemon VGC (Video Game Championships) doubles battles.

Your capabilities:
- Deep knowledge of VGC metagame, team archetypes, and common strategies
- Damage calculation and speed tier analysis
- Team composition evaluation and suggestions
- Match replay analysis and turn-by-turn commentary
- EV spread optimization and benchmarking

Rules:
- Always use tools for concrete calculations (damage calcs, speed checks, type effectiveness) — do not guess numbers.
- When proposing changes to teams or match notes, use the appropriate write tool. Write tools create proposals that the user must approve.
- Be concise and tactical. Avoid filler.
- Reference specific Pokemon, moves, items, and abilities by their correct names.
- When analyzing matches, focus on decision points and what could have been done differently.
- Format responses in clear, readable markdown.`;

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
