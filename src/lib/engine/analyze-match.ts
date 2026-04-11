/**
 * Match analysis orchestrator.
 *
 * Iterates through each turn of a battle, calculates win probability,
 * grades each player action, identifies turning points, and computes
 * overall summary statistics.
 */

import type { BattleMatch, Turn, TurnAction, FieldState, ActivePokemon } from "@/lib/types/battle";
import { DEFAULT_FIELD_STATE } from "@/lib/types/battle";
import type { MatchAnalysis, TurnAnalysis, MoveGradeResult } from "@/lib/types/analysis";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { calculateWinProbability, type GameState } from "./win-prob";
import { gradeMove, gradeToScore } from "./move-grade";

const TURNING_POINT_THRESHOLD = 15; // >15% win prob swing = turning point

/**
 * Analyze a full match and produce a complete MatchAnalysis.
 */
export function analyzeMatch(match: BattleMatch): MatchAnalysis {
  const winProbabilityCurve: { turn: number; probability: number }[] = [];
  const turnAnalyses: TurnAnalysis[] = [];
  const turningPoints: number[] = [];

  // Calculate initial win probability at turn 0 (before any actions)
  const initialState = buildInitialGameState(match);
  const initialProb = calculateWinProbability(initialState);
  winProbabilityCurve.push({ turn: 0, probability: initialProb });

  let previousProb = initialProb;

  // Process each turn
  for (const turn of match.turns) {
    const gameState = buildGameStateFromTurn(turn, match);
    const winProb = calculateWinProbability(gameState);

    // Grade each P1 action in this turn
    const moveGrades: MoveGradeResult[] = [];
    const p1Actions = turn.actions.filter((a) => a.side === "p1");

    for (const action of p1Actions) {
      // For each action, estimate the best possible win prob
      // In a full implementation, this would simulate all alternatives.
      // For now, we approximate using the actual win prob change.
      const bestPossibleWinProb = estimateBestWinProb(
        action,
        previousProb,
        winProb,
        turn,
        match,
      );

      const grade = gradeMove(action, previousProb, winProb, bestPossibleWinProb);
      moveGrades.push(grade);
    }

    // Detect turning points
    const probSwing = Math.abs(winProb - previousProb);
    const isTurningPoint = probSwing > TURNING_POINT_THRESHOLD;

    if (isTurningPoint) {
      turningPoints.push(turn.number);
    }

    winProbabilityCurve.push({ turn: turn.number, probability: winProb });

    turnAnalyses.push({
      turnNumber: turn.number,
      winProbability: winProb,
      isTurningPoint,
      moveGrades,
    });

    previousProb = winProb;
  }

  // Compute summary stats
  const summary = computeSummary(turnAnalyses);
  const overallScore = computeOverallScore(turnAnalyses);

  return {
    winProbabilityCurve,
    turnAnalyses,
    turningPoints,
    overallScore,
    summary,
  };
}

/**
 * Build initial game state from match data (before any turns happen).
 */
function buildInitialGameState(match: BattleMatch): GameState {
  const p1Pokemon = match.myBrought.map((species) => ({
    species,
    hpPercent: 100,
    isFainted: false,
  }));

  const p2Pokemon = match.opponentBrought.map((species) => ({
    species,
    hpPercent: 100,
    isFainted: false,
  }));

  return {
    p1Pokemon,
    p2Pokemon,
    fieldState: { ...DEFAULT_FIELD_STATE },
    p1Team: match.myTeam,
    p2Team: match.opponentTeam as TeamPokemon[],
  };
}

/**
 * Build game state from a specific turn's data.
 */
function buildGameStateFromTurn(turn: Turn, match: BattleMatch): GameState {
  const p1Pokemon = activePokemonToGameState(turn.activeP1, match.myBrought);
  const p2Pokemon = activePokemonToGameState(turn.activeP2, match.opponentBrought);

  return {
    p1Pokemon,
    p2Pokemon,
    fieldState: turn.fieldState ?? { ...DEFAULT_FIELD_STATE },
    p1Team: match.myTeam,
    p2Team: match.opponentTeam as TeamPokemon[],
  };
}

/**
 * Convert active Pokemon data from turn to game state format.
 * Includes benched Pokemon from the brought list that aren't shown as active.
 */
function activePokemonToGameState(
  active: ActivePokemon[],
  brought: string[],
): GameState["p1Pokemon"] {
  const result: GameState["p1Pokemon"] = [];
  const seenSpecies = new Set<string>();

  // Add active Pokemon
  for (const mon of active) {
    seenSpecies.add(mon.species);
    result.push({
      species: mon.species,
      hpPercent: mon.hpPercent,
      isFainted: mon.hpPercent <= 0,
    });
  }

  // Add benched Pokemon from brought list (assumed full HP if not active and not fainted)
  for (const species of brought) {
    if (!seenSpecies.has(species)) {
      result.push({
        species,
        hpPercent: 100,
        isFainted: false,
      });
    }
  }

  return result;
}

/**
 * Estimate the best possible win probability for this turn.
 *
 * In a full engine, we would simulate all alternative actions and pick the best.
 * For now, we use a heuristic: if the action improved things, it's close to optimal.
 * If it worsened things, the best is estimated as: previous + some of the positive delta.
 */
function estimateBestWinProb(
  action: TurnAction,
  previousProb: number,
  currentProb: number,
  turn: Turn,
  match: BattleMatch,
): number {
  const probChange = currentProb - previousProb;

  // If this turn has KOs or significant events, the optimal play
  // might have been substantially different
  const hasKo = turn.actions.some((a) => a.wasKo);
  const hasCrit = turn.actions.some((a) => a.wasCriticalHit);

  if (probChange >= 0) {
    // If the position improved, the best play might have been slightly better
    // but this was close to optimal
    const bonus = hasKo ? 3 : hasCrit ? 2 : 1;
    return Math.min(95, currentProb + bonus);
  }

  // If the position worsened, estimate how much better the best alternative was.
  // We assume optimal play would have at least maintained the position,
  // with some bonus based on the game state.
  const recoveryFactor = hasKo ? 0.5 : 0.3;
  const bestEstimate = previousProb + Math.abs(probChange) * recoveryFactor;
  return Math.min(95, Math.max(currentProb, bestEstimate));
}

/**
 * Compute summary counts of each grade type.
 */
function computeSummary(turnAnalyses: TurnAnalysis[]): MatchAnalysis["summary"] {
  let totalMoves = 0;
  let optimalCount = 0;
  let goodCount = 0;
  let inaccuracyCount = 0;
  let mistakeCount = 0;
  let blunderCount = 0;

  for (const turn of turnAnalyses) {
    for (const grade of turn.moveGrades) {
      totalMoves++;
      switch (grade.grade) {
        case "optimal":
          optimalCount++;
          break;
        case "good":
          goodCount++;
          break;
        case "inaccuracy":
          inaccuracyCount++;
          break;
        case "mistake":
          mistakeCount++;
          break;
        case "blunder":
          blunderCount++;
          break;
      }
    }
  }

  return {
    totalMoves,
    optimalCount,
    goodCount,
    inaccuracyCount,
    mistakeCount,
    blunderCount,
  };
}

/**
 * Compute overall match score (0-100) as weighted average of move grades.
 * optimal=100, good=85, inaccuracy=60, mistake=30, blunder=0
 */
function computeOverallScore(turnAnalyses: TurnAnalysis[]): number {
  let totalScore = 0;
  let count = 0;

  for (const turn of turnAnalyses) {
    for (const grade of turn.moveGrades) {
      totalScore += gradeToScore(grade.grade);
      count++;
    }
  }

  if (count === 0) return 100; // No moves to grade = perfect by default

  return Math.round(totalScore / count);
}
