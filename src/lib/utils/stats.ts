// ---------------------------------------------------------------------------
// Pure utility functions for match statistics calculations.
// No DB or React dependencies — easily testable.
// ---------------------------------------------------------------------------

export interface WinRateResult {
  wins: number;
  losses: number;
  total: number;
  /** 0–100 */
  winRate: number;
}

export function calculateWinRate(
  matches: { result: string }[],
): WinRateResult {
  const total = matches.length;
  if (total === 0) return { wins: 0, losses: 0, total: 0, winRate: 0 };
  const wins = matches.filter((m) => m.result === "win").length;
  const losses = total - wins;
  const winRate = Math.round((wins / total) * 10000) / 100;
  return { wins, losses, total, winRate };
}

// ---------------------------------------------------------------------------
// Win rate grouped by calendar period
// ---------------------------------------------------------------------------

export interface PeriodWinRate {
  period: string;
  wins: number;
  losses: number;
  winRate: number;
}

function periodKey(
  timestamp: number,
  period: "day" | "week" | "month",
): string {
  const d = new Date(timestamp);
  if (period === "day") {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  if (period === "month") {
    return d.toISOString().slice(0, 7); // YYYY-MM
  }
  // week: use ISO week starting Monday
  const dayOfWeek = d.getUTCDay();
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((dayOfWeek + 6) % 7));
  return `W${monday.toISOString().slice(0, 10)}`;
}

export function calculateWinRateByPeriod(
  matches: { result: string; playedAt: number }[],
  period: "day" | "week" | "month",
): PeriodWinRate[] {
  const buckets = new Map<string, { wins: number; losses: number }>();

  for (const m of matches) {
    const key = periodKey(m.playedAt, period);
    const bucket = buckets.get(key) ?? { wins: 0, losses: 0 };
    if (m.result === "win") bucket.wins++;
    else bucket.losses++;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { wins, losses }]) => {
      const total = wins + losses;
      return {
        period: key,
        wins,
        losses,
        winRate: total > 0 ? Math.round((wins / total) * 10000) / 100 : 0,
      };
    });
}

// ---------------------------------------------------------------------------
// Rolling win rate over a sliding window
// ---------------------------------------------------------------------------

export interface RollingWinRatePoint {
  index: number;
  /** Label for chart display, e.g. "Match 10" */
  label: string;
  winRate: number;
}

export function calculateRollingWinRate(
  matches: { result: string }[],
  window: number,
): RollingWinRatePoint[] {
  if (matches.length < window) return [];

  const results: RollingWinRatePoint[] = [];
  let winsInWindow = 0;

  // Seed the first window
  for (let i = 0; i < window; i++) {
    if (matches[i].result === "win") winsInWindow++;
  }
  results.push({
    index: window - 1,
    label: `Match ${window}`,
    winRate: Math.round((winsInWindow / window) * 10000) / 100,
  });

  // Slide
  for (let i = window; i < matches.length; i++) {
    if (matches[i].result === "win") winsInWindow++;
    if (matches[i - window].result === "win") winsInWindow--;
    results.push({
      index: i,
      label: `Match ${i + 1}`,
      winRate: Math.round((winsInWindow / window) * 10000) / 100,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Pokemon usage & win rates
// ---------------------------------------------------------------------------

export interface PokemonUsageStat {
  species: string;
  timesBrought: number;
  timesLed: number;
  winRateWhenBrought: number;
  winRateWhenLed: number;
}

export function calculatePokemonUsage(
  matches: { myBrought: string[]; myLeads: string[]; result: string }[],
): PokemonUsageStat[] {
  if (matches.length === 0) return [];

  const stats = new Map<
    string,
    {
      brought: number;
      led: number;
      winsWhenBrought: number;
      winsWhenLed: number;
    }
  >();

  for (const m of matches) {
    const isWin = m.result === "win";
    const brought = m.myBrought ?? [];
    const leads = m.myLeads ?? [];

    for (const species of brought) {
      const s = stats.get(species) ?? {
        brought: 0,
        led: 0,
        winsWhenBrought: 0,
        winsWhenLed: 0,
      };
      s.brought++;
      if (isWin) s.winsWhenBrought++;
      stats.set(species, s);
    }

    for (const species of leads) {
      const s = stats.get(species) ?? {
        brought: 0,
        led: 0,
        winsWhenBrought: 0,
        winsWhenLed: 0,
      };
      s.led++;
      if (isWin) s.winsWhenLed++;
      stats.set(species, s);
    }
  }

  return Array.from(stats.entries())
    .map(([species, s]) => ({
      species,
      timesBrought: s.brought,
      timesLed: s.led,
      winRateWhenBrought:
        s.brought > 0
          ? Math.round((s.winsWhenBrought / s.brought) * 10000) / 100
          : 0,
      winRateWhenLed:
        s.led > 0
          ? Math.round((s.winsWhenLed / s.led) * 10000) / 100
          : 0,
    }))
    .sort((a, b) => b.timesBrought - a.timesBrought);
}

// ---------------------------------------------------------------------------
// Archetype matchups
// ---------------------------------------------------------------------------

export interface ArchetypeMatchup {
  archetype: string;
  wins: number;
  losses: number;
  winRate: number;
}

export function calculateArchetypeMatchups(
  matches: { archetypeOpponent?: string; result: string }[],
): ArchetypeMatchup[] {
  const buckets = new Map<string, { wins: number; losses: number }>();

  for (const m of matches) {
    if (!m.archetypeOpponent) continue;
    const bucket = buckets.get(m.archetypeOpponent) ?? {
      wins: 0,
      losses: 0,
    };
    if (m.result === "win") bucket.wins++;
    else bucket.losses++;
    buckets.set(m.archetypeOpponent, bucket);
  }

  return Array.from(buckets.entries()).map(([archetype, { wins, losses }]) => {
    const total = wins + losses;
    return {
      archetype,
      wins,
      losses,
      winRate: total > 0 ? Math.round((wins / total) * 10000) / 100 : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Streak info
// ---------------------------------------------------------------------------

export interface StreakInfo {
  currentStreak: number;
  streakType: "win" | "loss";
  longestWinStreak: number;
  longestLossStreak: number;
}

/**
 * Expects matches ordered most-recent-first (index 0 = newest).
 */
export function getStreakInfo(matches: { result: string }[]): StreakInfo {
  if (matches.length === 0) {
    return {
      currentStreak: 0,
      streakType: "win",
      longestWinStreak: 0,
      longestLossStreak: 0,
    };
  }

  // Current streak
  const firstResult = matches[0].result as "win" | "loss";
  let currentStreak = 0;
  for (const m of matches) {
    if (m.result === firstResult) currentStreak++;
    else break;
  }

  // Longest streaks
  let longestWin = 0;
  let longestLoss = 0;
  let runType = matches[0].result;
  let runLength = 0;

  for (const m of matches) {
    if (m.result === runType) {
      runLength++;
    } else {
      if (runType === "win") longestWin = Math.max(longestWin, runLength);
      else longestLoss = Math.max(longestLoss, runLength);
      runType = m.result;
      runLength = 1;
    }
  }
  // Flush the last run
  if (runType === "win") longestWin = Math.max(longestWin, runLength);
  else longestLoss = Math.max(longestLoss, runLength);

  return {
    currentStreak,
    streakType: firstResult,
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
  };
}
