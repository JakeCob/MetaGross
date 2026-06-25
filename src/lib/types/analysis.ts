// Types for match analysis, move grading, and win probability

export type MoveGrade = 'optimal' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface MoveGradeResult {
  grade: MoveGrade;
  reason: string;
  optimalPlay: string;
  winProbDelta: number; // how much win prob changed vs optimal
}

export interface TurnAnalysis {
  turnNumber: number;
  winProbability: number;    // 0-100
  isTurningPoint: boolean;
  moveGrades: MoveGradeResult[];
}

export interface MatchAnalysis {
  winProbabilityCurve: { turn: number; probability: number }[];
  turnAnalyses: TurnAnalysis[];
  turningPoints: number[];   // turn numbers
  overallScore: number;      // 0-100 match quality
  summary: {
    totalMoves: number;
    optimalCount: number;
    goodCount: number;
    inaccuracyCount: number;
    mistakeCount: number;
    blunderCount: number;
  };
}

export interface AIMatchAnalysis {
  summary: string;
  keyTurningPoints: {
    turn: number;
    description: string;
  }[];
  improvements: string[];
  strengths: string[];
  overallAssessment: string;
}

export interface PreMatchStrategy {
  recommendedLeads: { species: [string, string]; reasoning: string };
  recommendedBring4: { species: string[]; reasoning: string };
  gamePlan: string;
  keyThreats: { species: string; threat: string }[];
  megaTiming: string;
  winCondition: string;
}

/** AI-suggested improvements for a team-in-progress: roster swaps + per-mon set
 *  tweaks. Rendered as the builder's "Potential changes" panel. */
export interface PotentialChangeAnalysis {
  /** Roster-level ideas ("Add a Steel-type to threaten Fairies"). */
  swaps: {
    title: string;
    reasoning: string;
    /** The specific Pokémon this swap suggests adding, if it names one — used
     *  to validate format legality (illegal picks are dropped). */
    addMon?: string;
  }[];
  /** Per-Pokémon set tweaks ("Garchomp: add Protect for survivability"). */
  setTweaks: {
    species: string;
    suggestion: string;
    /** When the tweak is a concrete swap, the structured change so the UI can
     *  one-click apply it to the slot. Omitted for vague advice. */
    apply?: {
      item?: string;
      ability?: string;
      nature?: string;
      /** A move to add (fills the first empty move slot, else replaces the last). */
      addMove?: string;
    };
  }[];
  /** Optional closing note / overall direction. */
  note?: string;
}

/** AI-suggested lead+back combinations with a gameplan blurb each. Rendered as
 *  the builder's "Common combinations" panel. */
export interface CommonCombinationsAnalysis {
  combos: {
    leads: string[]; // usually 2
    back: string[]; // usually 2
    strategy: string;
  }[];
  note?: string;
}

// Damage calculation result
export interface DamageResult {
  minDamage: number;
  maxDamage: number;
  minPercent: number;
  maxPercent: number;
  koChance: {
    ohko: number;    // probability 0-1
    twohko: number;
    threehko: number;
  };
  rolls: number[];
}
