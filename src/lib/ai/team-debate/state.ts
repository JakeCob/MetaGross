import { Annotation } from "@langchain/langgraph";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";
import type { AITeamMember, TeamViolation } from "@/lib/team-analysis/team-context";
import type { EVSpread } from "@/lib/types/pokemon";
import { type DebateMode, DEFAULT_MODE } from "./modes";

/** A Pokemon in the proposed team. Full set is optional until finalize. */
export interface DraftMember {
  species: string;
  role?: string;
  item?: string;
  ability?: string;
  moves?: string[];
  note?: string;
  /** Filled in by finalize's EV-optimization pass. */
  nature?: string;
  /** Champions-point spread (0-32/stat) from the EV optimizer. */
  evs?: EVSpread;
}

/** One line in the debate transcript surfaced to the user. */
export interface TranscriptEntry {
  /** Stable agent id (propose / offense / defense / analyst / critic / finalize). */
  agent: string;
  /** Display name for the UI. */
  label: string;
  /** Which debate round this entry belongs to (1-based). */
  round: number;
  text: string;
}

export const TeamDebateState = Annotation.Root({
  // --- Input (set once) ---
  format: Annotation<string>({
    reducer: (_p, n) => n,
    default: () => ACTIVE_REGULATION_FORMAT_ID,
  }),
  /** Locked-in members the user wants the team built around (may be empty). */
  seed: Annotation<AITeamMember[]>({
    reducer: (_p, n) => n,
    default: () => [],
  }),
  /** Optional free-text brief / win condition from the user. */
  brief: Annotation<string>({
    reducer: (_p, n) => n,
    default: () => "",
  }),
  /** Ladder (closed sheet → surprise OK) vs tournament (open sheet → proven). */
  mode: Annotation<DebateMode>({
    reducer: (_p, n) => n,
    default: () => DEFAULT_MODE,
  }),

  // --- Working draft ---
  draft: Annotation<DraftMember[]>({
    reducer: (_p, n) => n,
    default: () => [],
  }),

  // --- Persona reviews (latest round) ---
  offenseReview: Annotation<string | null>({
    reducer: (_p, n) => n,
    default: () => null,
  }),
  defenseReview: Annotation<string | null>({
    reducer: (_p, n) => n,
    default: () => null,
  }),
  analystReview: Annotation<string | null>({
    reducer: (_p, n) => n,
    default: () => null,
  }),
  /** Grounding facts the analyst pulled (Pikalytics partners, threats, matchups). */
  analystData: Annotation<string>({
    reducer: (_p, n) => n,
    default: () => "",
  }),
  critique: Annotation<string | null>({
    reducer: (_p, n) => n,
    default: () => null,
  }),
  /** Deterministic audit of the latest draft. */
  violations: Annotation<TeamViolation[]>({
    reducer: (_p, n) => n,
    default: () => [],
  }),

  // --- Transcript (accumulates across the whole run) ---
  transcript: Annotation<TranscriptEntry[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // --- Output ---
  finalTeam: Annotation<DraftMember[] | null>({
    reducer: (_p, n) => n,
    default: () => null,
  }),
  finalSummary: Annotation<string | null>({
    reducer: (_p, n) => n,
    default: () => null,
  }),

  // --- Iteration control ---
  round: Annotation<number>({
    reducer: (_p, n) => n,
    default: () => 0,
  }),
  maxRounds: Annotation<number>({
    reducer: (_p, n) => n,
    default: () => 2,
  }),
});

export type TeamDebateStateType = typeof TeamDebateState.State;
export type TeamDebateStateUpdate = typeof TeamDebateState.Update;
