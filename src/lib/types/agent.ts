// Agent personas
export type AgentPersona = 'default' | 'wolfe_glick' | 'cybertron' | 'analyst' | 'aggressive_coach' | 'defensive_coach';

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
  payload: unknown;    // structured data for the write
}

// Chat message for UI
export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: { name: string; args: unknown; result?: unknown }[];
  pendingApproval?: WriteActionProposal;
  timestamp: number;
}
