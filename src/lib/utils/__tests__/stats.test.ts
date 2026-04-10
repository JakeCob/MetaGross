import { describe, it, expect } from "vitest";
import {
  calculateWinRate,
  calculateWinRateByPeriod,
  calculateRollingWinRate,
  calculatePokemonUsage,
  calculateArchetypeMatchups,
  getStreakInfo,
} from "../stats";

// ---------------------------------------------------------------------------
// calculateWinRate
// ---------------------------------------------------------------------------
describe("calculateWinRate", () => {
  it("returns correct stats for mixed results", () => {
    const matches = [
      { result: "win" },
      { result: "loss" },
      { result: "win" },
      { result: "win" },
      { result: "loss" },
    ];
    const result = calculateWinRate(matches);
    expect(result).toEqual({
      wins: 3,
      losses: 2,
      total: 5,
      winRate: 60,
    });
  });

  it("returns zeroes for an empty array", () => {
    const result = calculateWinRate([]);
    expect(result).toEqual({
      wins: 0,
      losses: 0,
      total: 0,
      winRate: 0,
    });
  });

  it("handles all wins", () => {
    const matches = [{ result: "win" }, { result: "win" }, { result: "win" }];
    const result = calculateWinRate(matches);
    expect(result.winRate).toBe(100);
    expect(result.wins).toBe(3);
    expect(result.losses).toBe(0);
  });

  it("handles all losses", () => {
    const matches = [{ result: "loss" }, { result: "loss" }];
    const result = calculateWinRate(matches);
    expect(result.winRate).toBe(0);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// calculatePokemonUsage
// ---------------------------------------------------------------------------
describe("calculatePokemonUsage", () => {
  it("calculates usage stats correctly for sample matches", () => {
    const matches = [
      {
        myBrought: ["Charizard", "Pikachu", "Mewtwo", "Landorus"],
        myLeads: ["Charizard", "Pikachu"],
        result: "win",
      },
      {
        myBrought: ["Charizard", "Pikachu", "Incineroar", "Landorus"],
        myLeads: ["Charizard", "Incineroar"],
        result: "loss",
      },
      {
        myBrought: ["Charizard", "Mewtwo", "Incineroar", "Landorus"],
        myLeads: ["Mewtwo", "Incineroar"],
        result: "win",
      },
    ];

    const usage = calculatePokemonUsage(matches);

    // Should be sorted by timesBrought descending
    expect(usage[0].species).toBe("Charizard");
    expect(usage[0].timesBrought).toBe(3);
    expect(usage[0].timesLed).toBe(2);
    // Charizard: won 2 out of 3 brought, won 1 out of 2 led
    expect(usage[0].winRateWhenBrought).toBeCloseTo(66.67, 1);
    expect(usage[0].winRateWhenLed).toBe(50);

    // Landorus brought 3 times, never led
    const landorus = usage.find((u) => u.species === "Landorus")!;
    expect(landorus.timesBrought).toBe(3);
    expect(landorus.timesLed).toBe(0);
    expect(landorus.winRateWhenBrought).toBeCloseTo(66.67, 1);
    expect(landorus.winRateWhenLed).toBe(0);

    // Pikachu brought 2 times, led 1 time
    const pikachu = usage.find((u) => u.species === "Pikachu")!;
    expect(pikachu.timesBrought).toBe(2);
    expect(pikachu.timesLed).toBe(1);
    expect(pikachu.winRateWhenBrought).toBe(50);
    expect(pikachu.winRateWhenLed).toBe(100);
  });

  it("returns empty array for no matches", () => {
    expect(calculatePokemonUsage([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getStreakInfo
// ---------------------------------------------------------------------------
describe("getStreakInfo", () => {
  it("detects a current win streak", () => {
    // Matches are ordered most-recent-first
    const matches = [
      { result: "win" },
      { result: "win" },
      { result: "win" },
      { result: "loss" },
      { result: "win" },
    ];
    const info = getStreakInfo(matches);
    expect(info.currentStreak).toBe(3);
    expect(info.streakType).toBe("win");
    expect(info.longestWinStreak).toBe(3);
    expect(info.longestLossStreak).toBe(1);
  });

  it("detects a current loss streak", () => {
    const matches = [
      { result: "loss" },
      { result: "loss" },
      { result: "win" },
      { result: "win" },
      { result: "win" },
    ];
    const info = getStreakInfo(matches);
    expect(info.currentStreak).toBe(2);
    expect(info.streakType).toBe("loss");
    expect(info.longestWinStreak).toBe(3);
    expect(info.longestLossStreak).toBe(2);
  });

  it("handles empty array", () => {
    const info = getStreakInfo([]);
    expect(info.currentStreak).toBe(0);
    expect(info.streakType).toBe("win");
    expect(info.longestWinStreak).toBe(0);
    expect(info.longestLossStreak).toBe(0);
  });

  it("handles single match", () => {
    const info = getStreakInfo([{ result: "win" }]);
    expect(info.currentStreak).toBe(1);
    expect(info.streakType).toBe("win");
    expect(info.longestWinStreak).toBe(1);
    expect(info.longestLossStreak).toBe(0);
  });

  it("tracks longest streaks across the full history", () => {
    const matches = [
      { result: "loss" },
      { result: "win" },
      { result: "win" },
      { result: "win" },
      { result: "win" },
      { result: "win" },
      { result: "loss" },
      { result: "loss" },
      { result: "loss" },
    ];
    const info = getStreakInfo(matches);
    expect(info.currentStreak).toBe(1);
    expect(info.streakType).toBe("loss");
    expect(info.longestWinStreak).toBe(5);
    expect(info.longestLossStreak).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// calculateArchetypeMatchups
// ---------------------------------------------------------------------------
describe("calculateArchetypeMatchups", () => {
  it("groups wins and losses by archetype", () => {
    const matches = [
      { archetypeOpponent: "Sun", result: "win" },
      { archetypeOpponent: "Sun", result: "loss" },
      { archetypeOpponent: "Rain", result: "win" },
      { archetypeOpponent: "Rain", result: "win" },
      { archetypeOpponent: undefined, result: "win" },
    ];
    const matchups = calculateArchetypeMatchups(matches);
    const sun = matchups.find((m) => m.archetype === "Sun")!;
    expect(sun.wins).toBe(1);
    expect(sun.losses).toBe(1);
    expect(sun.winRate).toBe(50);

    const rain = matchups.find((m) => m.archetype === "Rain")!;
    expect(rain.wins).toBe(2);
    expect(rain.losses).toBe(0);
    expect(rain.winRate).toBe(100);

    // Matches with no archetype should be excluded
    expect(matchups.find((m) => m.archetype === "Unknown")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// calculateWinRateByPeriod
// ---------------------------------------------------------------------------
describe("calculateWinRateByPeriod", () => {
  it("groups matches by day", () => {
    const day1 = new Date("2025-01-15T10:00:00Z").getTime();
    const day2 = new Date("2025-01-16T14:00:00Z").getTime();
    const matches = [
      { result: "win", playedAt: day1 },
      { result: "loss", playedAt: day1 },
      { result: "win", playedAt: day2 },
    ];
    const periods = calculateWinRateByPeriod(matches, "day");
    expect(periods).toHaveLength(2);
    // Sorted chronologically
    expect(periods[0].wins).toBe(1);
    expect(periods[0].losses).toBe(1);
    expect(periods[0].winRate).toBe(50);
    expect(periods[1].wins).toBe(1);
    expect(periods[1].losses).toBe(0);
    expect(periods[1].winRate).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// calculateRollingWinRate
// ---------------------------------------------------------------------------
describe("calculateRollingWinRate", () => {
  it("calculates rolling win rate with given window", () => {
    const matches = [
      { result: "win" },
      { result: "win" },
      { result: "loss" },
      { result: "win" },
      { result: "loss" },
    ];
    const rolling = calculateRollingWinRate(matches, 3);
    // Window of 3: indices 2,3,4 get values
    expect(rolling).toHaveLength(3);
    // First window (indices 0,1,2): win, win, loss => 66.67
    expect(rolling[0].index).toBe(2);
    expect(rolling[0].winRate).toBeCloseTo(66.67, 1);
    // Second window (indices 1,2,3): win, loss, win => 66.67
    expect(rolling[1].index).toBe(3);
    expect(rolling[1].winRate).toBeCloseTo(66.67, 1);
    // Third window (indices 2,3,4): loss, win, loss => 33.33
    expect(rolling[2].index).toBe(4);
    expect(rolling[2].winRate).toBeCloseTo(33.33, 1);
  });

  it("returns empty for window larger than matches", () => {
    const matches = [{ result: "win" }, { result: "loss" }];
    const rolling = calculateRollingWinRate(matches, 5);
    expect(rolling).toHaveLength(0);
  });
});
