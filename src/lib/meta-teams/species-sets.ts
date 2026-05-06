/**
 * Pull verified tournament/creator sets for a single species from the
 * meta-team pool. Used by the EV debate, team-build prompt, and battle
 * logger to anchor LLM proposals in real tournament data instead of
 * inventing moves that don't make sense.
 *
 * Source priority is by `trust` desc:
 *   creator (1.0) > limitless (0.95) > vgcpastes (0.85) > pikalytics > ...
 */
import "server-only";

import { listMetaTeams } from "./queries";
import type { MetaTeam, MetaTeamPokemon, MetaTeamSource } from "./types";

export interface ReferenceSet {
  species: string;
  ability?: string;
  item?: string;
  nature?: string;
  moves: string[];
  teraType?: string;
  evs?: string;
  ivs?: string;
  source: MetaTeamSource;
  author: string | null;
  record: string | null;
  sourceUrl: string | null;
  trust: number;
}

function speciesEquals(a: string, b: string): boolean {
  // Forgiving match — VGCPastes uses "Floette-Eternal", agent might
  // type "Floette Eternal" or "Mega Floette" or "Floette-Mega".
  const norm = (s: string) =>
    s.toLowerCase().replace(/^mega\s+/, "").replace(/\s+/g, "-").replace(/-mega(-[xy])?$/i, "");
  return norm(a) === norm(b);
}

/**
 * Find every meta-team entry whose pokemon[] contains the target
 * species, return the per-species set sorted by trust desc.
 *
 * @param species  Target species name (Mega/non-Mega both accepted).
 * @param format   Format id, default "champions-reg-m-a".
 * @param limit    Max number of sets to return. Default 6.
 */
export async function getReferenceSetsForSpecies(
  species: string,
  format: string = "champions-reg-m-a",
  limit: number = 6,
): Promise<ReferenceSet[]> {
  const teams = await listMetaTeams(format, 500);
  const out: ReferenceSet[] = [];
  for (const team of teams) {
    if (!Array.isArray(team.pokemon) || team.pokemon.length === 0) continue;
    const slot = team.pokemon.find((p) => speciesEquals(p.species ?? "", species));
    if (!slot) continue;
    out.push(buildReferenceSet(slot, team));
  }
  // Sort by trust desc, then by recency (seenAt or createdAt).
  out.sort((a, b) => {
    if (b.trust !== a.trust) return b.trust - a.trust;
    return 0; // listMetaTeams already orders by recency, so stable-sort preserves it.
  });
  // Dedupe by (moves+nature+item+ability) so VGCPastes + Limitless
  // copies of the same set don't crowd the model context.
  const seen = new Set<string>();
  const deduped: ReferenceSet[] = [];
  for (const s of out) {
    const key = [
      s.moves.slice(0, 4).join("|").toLowerCase(),
      (s.nature ?? "").toLowerCase(),
      (s.item ?? "").toLowerCase(),
      (s.ability ?? "").toLowerCase(),
    ].join("::");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

function buildReferenceSet(slot: MetaTeamPokemon, team: MetaTeam): ReferenceSet {
  return {
    species: slot.species,
    ability: slot.ability,
    item: slot.item,
    nature: slot.nature,
    moves: (slot.moves ?? []).filter((m) => m && m.trim().length > 0),
    teraType: slot.teraType,
    evs: slot.evs,
    ivs: slot.ivs,
    source: team.source,
    author: team.author,
    record: team.record,
    sourceUrl: team.sourceUrl,
    trust: team.trust ?? 0,
  };
}

/**
 * Format a list of reference sets as a markdown block ready to embed
 * in an LLM prompt. Each entry is concise so we don't blow the
 * context window — moves + item + ability + author + source.
 */
export function formatReferenceSetsBlock(sets: ReferenceSet[]): string {
  if (sets.length === 0) {
    return "(no verified tournament/creator sets found in our pool for this species)";
  }
  return sets
    .map((s, i) => {
      const movesStr = s.moves.length > 0 ? s.moves.join(" / ") : "(unspecified)";
      const parts = [
        `${i + 1}. [${s.source} · trust ${s.trust}]`,
        s.author ? s.author : "anon",
        s.record ? `— ${s.record}` : "",
      ];
      const head = parts.filter(Boolean).join(" ");
      const lines: string[] = [head];
      if (s.ability) lines.push(`   Ability: ${s.ability}`);
      if (s.item) lines.push(`   Item: ${s.item}`);
      if (s.nature) lines.push(`   Nature: ${s.nature}`);
      lines.push(`   Moves: ${movesStr}`);
      if (s.evs) lines.push(`   EVs: ${s.evs}`);
      if (s.teraType) lines.push(`   Tera: ${s.teraType}`);
      if (s.sourceUrl) lines.push(`   Source: ${s.sourceUrl}`);
      return lines.join("\n");
    })
    .join("\n\n");
}
