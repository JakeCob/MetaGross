/**
 * Opponent-scouting result cache.
 *
 * Keyed on a stable hash of the opponent-team snapshot so reveals that
 * change any species/ability/item invalidate the cache naturally.
 * Pattern mirrors src/lib/pokemon/pikalytics.ts (positive + negative
 * cache, short circuit on upstream failure).
 */
import type { ScoutingResult } from "./types";

// Re-export the client-safe hash so callers can keep importing from
// `./cache`. The implementation lives in ./hash so Client Components
// can import it without pulling in node-only deps.
export { hashOpponentSnapshot } from "./hash";

// ---------------------------------------------------------------------------
// TTL caches
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const POSITIVE_TTL_MS = 24 * 60 * 60 * 1000; // scouting results are stable
const NEGATIVE_TTL_MS = 5 * 60 * 1000; // circuit breaker on upstream failure

const positive = new Map<string, CacheEntry<ScoutingResult>>();
const negative = new Map<string, number>();

export function getCachedScouting(hash: string): ScoutingResult | null {
  const entry = positive.get(hash);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > POSITIVE_TTL_MS) {
    positive.delete(hash);
    return null;
  }
  return entry.data;
}

export function setCachedScouting(hash: string, result: ScoutingResult): void {
  positive.set(hash, { data: result, fetchedAt: Date.now() });
}

export function markScoutingUnreachable(hash: string): void {
  negative.set(hash, Date.now() + NEGATIVE_TTL_MS);
}

export function isScoutingNegCached(hash: string): boolean {
  const until = negative.get(hash);
  if (!until) return false;
  if (Date.now() > until) {
    negative.delete(hash);
    return false;
  }
  return true;
}

export function clearScoutingCache(): void {
  positive.clear();
  negative.clear();
}
