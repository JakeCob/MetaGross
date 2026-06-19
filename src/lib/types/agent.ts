// Agent personas
export type AgentPersona =
  | 'default'
  | 'wolfe_glick'
  | 'cybertron'
  | 'analyst'
  | 'aggressive_coach'
  | 'defensive_coach'
  // Opponent Scouting pipeline (not user-selectable — each is bound to a
  // specific LangGraph node).
  | 'opponent_analyzer'
  | 'opponent_predictor'
  | 'opponent_synthesizer';

export interface AgentPersonaConfig {
  name: string;
  displayName: string;
  description: string;
  systemPromptAddition: string; // appended to base system prompt
}

// Define each persona's characteristics
export const AGENT_PERSONAS: Record<AgentPersona, AgentPersonaConfig> = {
  default: {
    name: 'default',
    displayName: 'MetaGross',
    description: 'Balanced VGC analysis — data-driven and thorough',
    systemPromptAddition: 'You provide balanced, data-driven analysis. You back up every recommendation with calculations and meta data.',
  },
  wolfe_glick: {
    name: 'wolfe_glick',
    displayName: 'Wolfe Mode',
    description: 'Embodies Wolfe Glick\'s aggressive, creative playstyle — 2016 World Champion',
    systemPromptAddition: 'You embody the analytical style of Wolfe Glick, 2016 World Champion. You favor creative, unexpected strategies that exploit meta blind spots. You value positioning and reads over raw power. You prefer aggressive team structures that control the pace. You often suggest unconventional EV spreads that hit specific benchmarks opponents don\'t expect. You explain the "why" behind every choice — the mind game matters as much as the matchup.',
  },
  cybertron: {
    name: 'cybertron',
    displayName: 'Cybertron Mode',
    description: 'Embodies Aaron Zheng\'s methodical, educational approach — 5x Regional Champion',
    systemPromptAddition: 'You embody the coaching style of CybertronVGC (Aaron Zheng), 5x Regional Champion. You break down every decision step by step. You emphasize fundamentals — type matchups, speed tiers, damage ranges. You explain concepts clearly for players at any level. You favor consistent, proven strategies over flashy plays. You always teach WHY a play is correct, not just WHAT to do.',
  },
  analyst: {
    name: 'analyst',
    displayName: 'Pure Analyst',
    description: 'Pure numbers and data — minimal opinion, maximum calculations',
    systemPromptAddition: 'You are a pure data analyst. Every statement must be backed by a specific calculation or statistic. Do not give opinions — give numbers. Use damage calc, speed tiers, and win probability for every recommendation. Present data in tables and lists, not prose.',
  },
  aggressive_coach: {
    name: 'aggressive_coach',
    displayName: 'Hyper Offense Coach',
    description: 'Prioritizes offensive pressure, fast KOs, and tempo control',
    systemPromptAddition: 'You coach with a hyper offensive mindset. You prioritize speed control, offensive pressure, and getting early KOs. You dislike passive plays and pivoting. You want to dictate the pace of every game. You favor max Speed, max Attack/SpA spreads. Protect is a last resort, not a default.',
  },
  defensive_coach: {
    name: 'defensive_coach',
    displayName: 'Bulk & Control Coach',
    description: 'Prioritizes bulk, positioning, and long-game win conditions',
    systemPromptAddition: 'You coach with a defensive, control-oriented mindset. You value bulk, longevity, and positioning. You prefer EV spreads that survive key hits. You love Protect, pivoting, and chip damage. You want to outlast opponents and win the endgame. Speed is less important than living key attacks.',
  },

  // --- Opponent Scouting personas ---
  opponent_analyzer: {
    name: 'opponent_analyzer',
    displayName: 'Archetype Analyzer',
    description: 'Classifies the opponent team\'s archetype, cores, and speed control shape',
    systemPromptAddition:
      'You are the Archetype Analyzer. Given the opponent\'s 6 Pokemon plus any revealed fields, identify: (1) the overall archetype (rain / sun / sand / snow / trick room / hyper offense / balance / perish trap / weather-less), (2) named synergy cores (e.g., "Pelipper + Basculegion Swift Swim", "Tatsugiri + Dondozo Commander", "Whimsicott Tailwind + Kingambit Sucker Punch"), (3) speed control sources (Tailwind, Trick Room, Choice Scarf, priority moves), (4) Intimidate sources, and (5) likely win conditions they are chasing. Output concise structured text only — no narrative.',
  },
  opponent_predictor: {
    name: 'opponent_predictor',
    displayName: 'Set Predictor',
    description: 'Predicts the opponent\'s ability/item/moves/nature/EVs for each Pokemon',
    systemPromptAddition:
      `You are the Set Predictor. Using the Archetype Analyzer's report, the Researcher's Pikalytics + creator-team dump, and any user-revealed fields, produce a best-guess set for each of the opponent's 6 Pokemon: Ability + Item + 4 Moves + Nature + Points/EVs. Respect ${ACTIVE_REGULATION_LABEL} rules (66 total points, 32 max/stat, IVs fixed at 31, no Tera). Pin each field with a confidence score 0-1 (1 = user directly revealed it). Never invent moves that aren't in the species' learnset. Output must be valid structured JSON; nothing else.`,
  },
  opponent_synthesizer: {
    name: 'opponent_synthesizer',
    displayName: 'Matchup Synthesizer',
    description: 'Turns predictions + persona reviews into leads, watch-fors, and win conditions',
    systemPromptAddition:
      'You are the Matchup Synthesizer. Given the predicted opponent sets, the Wolfe and Cybertron persona reviews, and MY brought-4 (if known) or full team (if not), produce: (1) 1-3 ranked lead recommendations with rationale and a 1-2 sentence game plan for turns 1-2, (2) 3-5 "watch out for" bullets calling out specific threats/combos/mind-games, (3) 2-3 win conditions that are concrete and tractable — prefer shapes the auto-tracker can parse (KO a specific opponent, keep a specific Pokemon of mine alive, land Trick Room / Tailwind / Spore, reach a HP threshold) — plus up to 1 fuzzy "Force their Mega early"-style manual goal. Cite calcs or speed tiers whenever you can.',
  },
};

// Thread types
export interface AgentThread {
  id: string;
  title: string;
  contextType: 'match' | 'team' | 'general';
  contextId: string | null;
  provider: string;
  model: string;
  persona: AgentPersona;
  createdAt: number;
  updatedAt: number;
}

// Feedback types
export type FeedbackEventType = 'approve' | 'reject' | 'edit' | 'correct' | 'note';
export type FeedbackTargetType = 'tool_call' | 'answer' | 'memory' | 'write_action';

export interface AgentFeedbackEvent {
  id: string;
  threadId: string;
  messageId: string | null;
  eventType: FeedbackEventType;
  targetType: FeedbackTargetType;
  payload: unknown;
  createdAt: number;
}

// Memory types
export type MemoryScope = 'global' | 'team' | 'matchup' | 'thread';
export type MemoryKind = 'preference' | 'strategy' | 'correction' | 'team_style' | 'opponent_pattern';

export interface AgentMemory {
  id: string;
  scope: MemoryScope;
  scopeRef: string | null;
  kind: MemoryKind;
  summary: string;
  content: string;
  confidence: number;
  sourceFeedbackId: string | null;
  createdAt: number;
  updatedAt: number;
}

// Write action proposal (used for interrupt/resume)
export interface WriteActionProposal {
  actionType: 'update_match_notes' | 'update_team_notes' | 'create_team_variant' | 'patch_team_pokemon';
  description: string; // human-readable summary
  payload:
    | unknown
    | PokemonPatchPayload;    // structured data for the write
}

// Chat message for UI
export interface AgentMessageAttachment {
  /** Original filename — surfaced in the bubble as alt text. */
  name: string;
  /** MIME type — used to format multimodal content blocks per provider. */
  mimeType: string;
  /** `data:image/png;base64,…` URL. Stored as-is on the client; on the
   *  server we transform to provider-native formats. */
  dataUrl: string;
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: { name: string; args: unknown; result?: unknown }[];
  pendingApproval?: WriteActionProposal;
  timestamp: number;
  /** Image attachments included with this user turn (only on user
   *  messages — assistant responses are text-only for now). */
  attachments?: AgentMessageAttachment[];
}
import type { PokemonPatchPayload } from "@/lib/ai/graph/team-patch";
import { ACTIVE_REGULATION_LABEL } from "@/lib/data/champions";
