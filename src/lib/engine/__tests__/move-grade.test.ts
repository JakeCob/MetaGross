import { describe, it, expect } from "vitest";
import { gradeMove } from "../move-grade";
import type { TurnAction } from "@/lib/types/battle";

function makeAction(overrides: Partial<TurnAction> = {}): TurnAction {
  return {
    side: "p1",
    slot: 1,
    actionType: "move",
    moveName: "Iron Head",
    targetSide: "p2",
    targetSlot: 1,
    damageDealtPercent: 40,
    ...overrides,
  };
}

describe("gradeMove", () => {
  it("grades a move as 'optimal' when it produces the best win probability", () => {
    const result = gradeMove(
      makeAction(),
      50,  // winProbBefore
      65,  // winProbAfter
      65,  // bestPossibleWinProb
    );
    expect(result.grade).toBe("optimal");
  });

  it("grades a move as 'optimal' when within 2% of best", () => {
    const result = gradeMove(
      makeAction(),
      50,  // winProbBefore
      63,  // winProbAfter
      65,  // bestPossibleWinProb
    );
    expect(result.grade).toBe("optimal");
  });

  it("grades a move as 'good' when within 5% of optimal", () => {
    const result = gradeMove(
      makeAction(),
      50,  // winProbBefore
      61,  // winProbAfter (4% worse than 65)
      65,  // bestPossibleWinProb
    );
    expect(result.grade).toBe("good");
  });

  it("grades a move as 'inaccuracy' when 5-15% worse than optimal", () => {
    const result = gradeMove(
      makeAction(),
      50,  // winProbBefore
      55,  // winProbAfter (10% worse than 65)
      65,  // bestPossibleWinProb
    );
    expect(result.grade).toBe("inaccuracy");
  });

  it("grades a move as 'mistake' when it decreases win probability 15-30% from optimal", () => {
    const result = gradeMove(
      makeAction(),
      50,  // winProbBefore
      45,  // winProbAfter (20% worse than 65)
      65,  // bestPossibleWinProb
    );
    expect(result.grade).toBe("mistake");
  });

  it("grades a move as 'blunder' when it is 30%+ worse than optimal", () => {
    const result = gradeMove(
      makeAction(),
      50,  // winProbBefore
      30,  // winProbAfter (35% worse than 65)
      65,  // bestPossibleWinProb
    );
    expect(result.grade).toBe("blunder");
  });

  it("grades Protect when opponent targets you as optimal", () => {
    const result = gradeMove(
      makeAction({
        moveName: "Protect",
        damageDealtPercent: 0,
      }),
      50,  // winProbBefore
      55,  // winProbAfter (protect saved the pokemon)
      55,  // bestPossibleWinProb
    );
    expect(result.grade).toBe("optimal");
  });

  it("includes reason and optimal play description", () => {
    const result = gradeMove(
      makeAction({ moveName: "Iron Head" }),
      50,
      30,
      65,
    );
    expect(result.reason).toBeTruthy();
    expect(result.optimalPlay).toBeTruthy();
    expect(result.winProbDelta).toBe(35);
  });

  it("calculates correct winProbDelta", () => {
    const result = gradeMove(
      makeAction(),
      50,
      55,
      65,
    );
    // delta = bestPossibleWinProb - winProbAfter = 65 - 55 = 10
    expect(result.winProbDelta).toBe(10);
  });
});
