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
