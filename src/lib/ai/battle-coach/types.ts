/**
 * Battle Coach — per-turn live advice.
 *
 * Called every time a new turn starts (or the user clicks refresh).
 * Takes a snapshot of the live battle state + the pre-match scouting
 * result and returns concrete action recommendations with reasoning.
 *
 * Design choice: one LLM call per turn, no tool use, structured JSON
 * output. Cheap, fast, deterministic shape for the UI to render.
 */

export interface TurnActionAdvice {
  /** Pokemon species this advice applies to (from my active slot). */
  species: string;
  /** "Click Snarl" / "Click Protect" / "Switch to Garchomp" / "Click Scald into Clefable" */
  recommendation: string;
  /** One-sentence reasoning — cite calcs, speed tiers, matchup logic. */
  reasoning: string;
  /**
   * Optional target species when the recommendation is move-based and
   * targeting matters (e.g., "Scald into Clefable"). Lets the UI link
   * to the opponent slot.
   */
  target?: string;
}

export interface TurnAdvice {
  turnNumber: number;
  /** Per-slot recommendation for my side (up to 2 entries). */
  myActions: TurnActionAdvice[];
  /** What we think the opponent will do this turn + why. */
  opponentPlan: string;
  /** "If they do X instead, do Y" — short alternative plan. */
  backupPlan: string;
  /** Rough win probability estimate, 0-100. Used as a badge + colour. */
  winProbability: number;
  /** Optional caution or key note that doesn't fit elsewhere. */
  keyNote?: string;
  /** Free-form trailing paragraph if the agent wants extra context. */
  commentary?: string;
  /** Epoch ms — used for cache keying and UI freshness. */
  generatedAt: number;
}
