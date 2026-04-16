/**
 * Client-safe hash for opponent-team snapshots.
 *
 * Kept in its own file (with zero node-only imports) so Client
 * Components can compute the same hash the server uses without
 * dragging in pikalytics / logger / langgraph.
 *
 * It's NOT cryptographic — cache-invalidation only needs a stable,
 * deterministic fingerprint that matches server↔client. A tiny djb2
 * over a normalized JSON string is plenty.
 */
import type { TeamPokemon } from "@/lib/types/pokemon";

/**
 * Produce a short stable hash of the opponent-team snapshot.
 *
 * Includes species + revealed ability + revealed item, sorted by
 * species so it's order-independent. Reveals (mid-battle updates to
 * ability/item) change the hash and force a re-scout.
 */
export function hashOpponentSnapshot(
  opponentTeam: Partial<TeamPokemon>[],
  format: string,
): string {
  const normalized = opponentTeam
    .map((p) => ({
      species: (p.species ?? "").trim().toLowerCase(),
      ability: (p.ability ?? "").trim().toLowerCase(),
      item: (p.item ?? "").trim().toLowerCase(),
    }))
    .filter((p) => p.species.length > 0)
    .sort((a, b) => a.species.localeCompare(b.species));

  const payload = JSON.stringify({
    format: format.toLowerCase(),
    team: normalized,
  });

  return djb2(payload);
}

/**
 * djb2 string hash → 8-char hex. Collision-resistant enough for an
 * in-session cache key with ~dozens of entries.
 */
function djb2(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0; // h * 33 + c
  }
  // Force unsigned and pad to 8 hex chars.
  return (h >>> 0).toString(16).padStart(8, "0");
}
