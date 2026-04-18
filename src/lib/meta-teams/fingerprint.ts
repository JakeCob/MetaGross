/**
 * Meta-team fingerprinting.
 *
 * A team is identified by its sorted, lowercased, species-only list —
 * so the same 6 Pokemon always produce the same key no matter who
 * entered them or in what order. Item/ability/moveset variation does
 * NOT change the fingerprint: we treat "Pelipper Focus Sash Tailwind"
 * and "Pelipper Damp Rock Weather Ball" as the same team for
 * deduplication purposes.
 *
 * Normalisation rules:
 *   - Trim whitespace
 *   - Lowercase
 *   - Collapse hyphen/space variants to hyphen ("Mr Mime" → "mr-mime")
 *   - Drop forms that don't change species identity in VGC
 *     (we keep "basculegion-f", "urshifu-rapid-strike" because they
 *     ARE different competitively).
 *
 * The fingerprint is stored in the DB column AND used at match-time,
 * so both paths must run the same normaliser.
 */

/** Normalise a single species name for fingerprint comparison. */
export function normalizeSpeciesForFingerprint(species: string): string {
  return species
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build a fingerprint string from any iterable of species names.
 * Sort is stable and case-insensitive. Duplicates are kept (a team
 * with "Urshifu" listed twice is not a real team, but we don't want
 * to silently hide it).
 */
export function buildFingerprint(species: readonly string[]): string {
  const normalized = species
    .map(normalizeSpeciesForFingerprint)
    .filter(Boolean);
  const sorted = [...normalized].sort();
  return sorted.join("|");
}

/** Count how many of `candidate`'s species match any in `query`. */
export function countOverlap(
  query: readonly string[],
  candidate: readonly string[],
): number {
  const q = new Set(query.map(normalizeSpeciesForFingerprint).filter(Boolean));
  let hits = 0;
  for (const c of candidate) {
    if (q.has(normalizeSpeciesForFingerprint(c))) hits++;
  }
  return hits;
}
