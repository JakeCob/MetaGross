/**
 * Opponent Scouting — types.
 *
 * Produced by a multi-agent graph that analyzes the opponent's revealed
 * 6 Pokemon (plus any mid-battle reveals) and yields predicted sets,
 * suggested leads, things to watch for, and a proposed win-condition
 * checklist. Results live on the battle-logger store and are persisted
 * onto the match row so post-match analysis can reference them.
 */

import type { EVSpread, IVSpread } from "@/lib/types/pokemon";

// ---------------------------------------------------------------------------
// Predicted opponent set
// ---------------------------------------------------------------------------

/**
 * What the predictor thinks one of the opponent's 6 Pokemon is running.
 * Confidence is a 0-1 score that the LLM assigns based on meta usage
 * data and any mid-battle reveals it has observed.
 */
export interface PredictedSet {
  species: string;
  ability: string;
  item: string;
  /** Exactly 4 move slots; empty strings allowed when the predictor is unsure. */
  moves: [string, string, string, string];
  nature: string;
  level: number;
  /**
   * EVs in whichever scale the format uses. For Champions, callers should
   * treat these as stat Points (0-66 total). For traditional VGC, treat
   * as EVs (0-510 total). Use `scale` below to disambiguate.
   */
  evs: EVSpread;
  ivs: IVSpread;
  scale: "champions" | "traditional";
  /** 0-1; 1 = user already revealed this exact field, 0 = pure guess. */
  confidence: number;
  /** Short human-readable rationale per prediction. */
  rationale: string;
}

// ---------------------------------------------------------------------------
// Suggested leads
// ---------------------------------------------------------------------------

export interface SuggestedLead {
  /** Two species from MY brought-4 that should lead. */
  pair: [string, string];
  /** 0-100 score (higher is better) synthesized from speed/damage/matchup. */
  score: number;
  rationale: string;
  /** 1-2 sentences on how to play turn 1-2 against the predicted opponent leads. */
  gamePlan: string;
}

// ---------------------------------------------------------------------------
// Win conditions
// ---------------------------------------------------------------------------

/**
 * The auto-tracker supports these shape kinds directly. Anything else
 * falls back to `custom` which is a manual-checkbox goal.
 */
export type WinConditionKind =
  | "ko" // KO an opponent Pokemon of a specific species
  | "keep-alive" // Keep one of MY Pokemon from fainting
  | "move-landed" // Land a specific move at least once (Tailwind / Trick Room / Spore / etc.)
  | "field-state" // Get a specific field effect up (Trick Room, Tailwind on p1, Rain, etc.)
  | "hp-threshold" // Keep / bring a Pokemon above or below a HP %
  | "custom"; // Free-form; always manual

export type WinConditionStatus = "pending" | "met" | "failed" | "manual";

export interface WinCondition {
  id: string;
  /** User-facing label (e.g., "KO their Archaludon", "Land Trick Room by turn 2"). */
  label: string;
  kind: WinConditionKind;
  target?: {
    side?: "p1" | "p2";
    species?: string;
    moveName?: string;
    fieldEffect?:
      | "trickRoom"
      | "tailwindP1"
      | "tailwindP2"
      | "rain"
      | "sun"
      | "sand"
      | "snow"
      | "grassyTerrain"
      | "electricTerrain"
      | "psychicTerrain"
      | "mistyTerrain";
    hpPercent?: number;
    /** Optional turn deadline for "by turn N" style conditions. */
    byTurn?: number;
  };
  status: WinConditionStatus;
  /** False for `custom` — always manual. True when the tracker can parse it. */
  checkable: boolean;
  source: "agent" | "user";
  /** For user ordering when conditions are re-rendered. */
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Scouting result envelope
// ---------------------------------------------------------------------------

export type ScoutingStatus = "idle" | "running" | "done" | "error";

export interface ScoutingResult {
  /** One entry per known opponent Pokemon (normally 6). */
  predictedSets: PredictedSet[];
  /** Short label describing the opponent's overall plan. */
  archetype: string;
  /** Named synergies the opponent team leans on (e.g., "Pelipper + Basculegion Swift Swim"). */
  teamSynergies: string[];
  /** Up to 3 ranked lead recommendations for MY side. */
  suggestedLeads: SuggestedLead[];
  /** Specific threats / plays to watch out for. Bullet-style. */
  watchFor: string[];
  /** Agent-proposed win conditions — a copy lands in winConditions on accept. */
  suggestedWinConditions: WinCondition[];
  /** Raw persona notes for transparency / debugging. */
  wolfeNote: string;
  cybertronNote: string;
  /** One-paragraph synthesis from the final node. */
  synthesis: string;
  /** Epoch ms. */
  generatedAt: number;
  /** Number of times this scouting result has been re-run in the session. */
  reruns: number;
}
