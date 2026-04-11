/**
 * Move grading engine.
 *
 * Grades a move by comparing the resulting win probability to what
 * would have happened with the best alternative action.
 */

import type { TurnAction } from "@/lib/types/battle";
import type { MoveGrade, MoveGradeResult } from "@/lib/types/analysis";

/**
 * Grade a move by comparing win probability outcome to the optimal play.
 *
 * @param action - The action that was taken
 * @param winProbBefore - Win probability before the action
 * @param winProbAfter - Win probability after the action
 * @param bestPossibleWinProb - The best win probability achievable with optimal play
 * @returns MoveGradeResult with grade, reason, optimal play, and delta
 */
export function gradeMove(
  action: TurnAction,
  winProbBefore: number,
  winProbAfter: number,
  bestPossibleWinProb: number,
): MoveGradeResult {
  const delta = bestPossibleWinProb - winProbAfter;
  const grade = getGrade(delta);
  const reason = buildReason(action, grade, delta, winProbBefore, winProbAfter);
  const optimalPlay = buildOptimalPlayDescription(action, grade, bestPossibleWinProb, winProbAfter);

  return {
    grade,
    reason,
    optimalPlay,
    winProbDelta: delta,
  };
}

/**
 * Determine grade based on delta from optimal play.
 *
 * Thresholds:
 * - optimal: within 2% of best win prob
 * - good: within 5% of optimal
 * - inaccuracy: 5-15% worse than optimal
 * - mistake: 15-30% worse than optimal
 * - blunder: 30%+ worse than optimal
 */
function getGrade(delta: number): MoveGrade {
  if (delta <= 2) return "optimal";
  if (delta <= 5) return "good";
  if (delta <= 15) return "inaccuracy";
  if (delta <= 30) return "mistake";
  return "blunder";
}

function buildReason(
  action: TurnAction,
  grade: MoveGrade,
  delta: number,
  winProbBefore: number,
  winProbAfter: number,
): string {
  const moveName = action.moveName ?? action.actionType;
  const probChange = winProbAfter - winProbBefore;
  const probDirection = probChange >= 0 ? "increased" : "decreased";

  switch (grade) {
    case "optimal":
      return `${moveName} was the best or near-best play, win probability ${probDirection} by ${Math.abs(probChange).toFixed(0)}%.`;
    case "good":
      return `${moveName} was a solid choice, only ${delta.toFixed(0)}% below optimal. Win probability ${probDirection} by ${Math.abs(probChange).toFixed(0)}%.`;
    case "inaccuracy":
      return `${moveName} was ${delta.toFixed(0)}% below optimal. A better option was available.`;
    case "mistake":
      return `${moveName} was a significant error, ${delta.toFixed(0)}% below optimal. This materially worsened the position.`;
    case "blunder":
      return `${moveName} was a critical blunder, ${delta.toFixed(0)}% below optimal. This severely compromised the game.`;
  }
}

function buildOptimalPlayDescription(
  action: TurnAction,
  grade: MoveGrade,
  bestPossibleWinProb: number,
  winProbAfter: number,
): string {
  if (grade === "optimal") {
    return `${action.moveName ?? action.actionType} was the optimal choice.`;
  }

  const delta = bestPossibleWinProb - winProbAfter;
  return `A better option was available that would have resulted in ${bestPossibleWinProb.toFixed(0)}% win probability (+${delta.toFixed(0)}% vs. actual).`;
}

/**
 * Convert a MoveGrade to a numeric score for averaging.
 * optimal=100, good=85, inaccuracy=60, mistake=30, blunder=0
 */
export function gradeToScore(grade: MoveGrade): number {
  switch (grade) {
    case "optimal":
      return 100;
    case "good":
      return 85;
    case "inaccuracy":
      return 60;
    case "mistake":
      return 30;
    case "blunder":
      return 0;
  }
}
