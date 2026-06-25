/**
 * Victory Road aggregator (Champions Replica Teams).
 *
 * Victory Road (victoryroad.pro) curates proven, creator-credited Pokémon
 * Champions teams on its "Champions Replica" page — exactly the open-sheet
 * reference lists tournament players want. We scrape that page's team table and
 * upsert each into meta_teams with source='victoryroad'.
 *
 * Page:  https://victoryroad.pro/champions-replica/
 * Shape (observed via the rendered page): an HTML <table>; each <tr> = one team
 *   with the player name + Twitter, a "best results" cell (tournament + placement),
 *   six Pokémon sprites (`<img src="…gen9-champions/<species>.png">`), and a rental
 *   "Code" (e.g. SQMPYRW6BP). No full sets are published on the table — teams are
 *   imported as species skeletons (the EV-pass / debate completes them).
 *
 * Verified against the live page: the row/sprite/code regexes + author/record
 * extraction were run against the real HTML and pull e.g. author "Pablo Rico",
 * record "The Champions Arena Top 16 (18 Apr 2026)", code "XPPGN8S1NV", and the
 * 6 species. Victory Road can restyle the page, so treat selectors as best-effort.
 *
 * SERVER-ONLY.
 */
import "server-only";

import { upsertMetaTeam } from "./queries";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

export const VICTORY_ROAD_REPLICA_URL =
  "https://victoryroad.pro/champions-replica/";

export interface AggregateVictoryRoadOptions {
  /** Override the page URL (e.g. an event page) — defaults to Champions Replica. */
  url?: string;
  /** Internal format id stored on the row. */
  internalFormat?: string;
  /** Cap rows ingested this run. Defaults to all. */
  limit?: number;
  fetchTimeoutMs?: number;
}

export interface AggregateVictoryRoadResult {
  teamsConsidered: number;
  teamsInserted: number;
  teamsSkipped: number;
  errors: Array<{ team: string | null; error: string }>;
}

export interface VictoryRoadTeam {
  species: string[];
  author: string | null;
  record: string | null;
  rentalCode: string | null;
}

async function fetchHtml(
  url: string,
  timeoutMs = 15000,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "MetaGrossBot/1.0" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Turn a Victory Road sprite filename stem into a species name. Hyphens are
 *  kept (form names) so "rotom-wash" → "Rotom-Wash", "floette-eternal" →
 *  "Floette-Eternal" (the @pkmn-canonical form shape). "charizard" → "Charizard".
 *  The meta_teams fingerprint normalises for dedup downstream. */
export function spriteStemToSpecies(stem: string): string {
  return stem
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("-");
}

/**
 * Parse the Champions Replica HTML into teams. Splits on <tr> rows and, for each
 * row, harvests the (up to 6) Champions sprite species, plus best-effort player /
 * record / rental code.
 */
export function parseVictoryRoadReplica(html: string): VictoryRoadTeam[] {
  const teams: VictoryRoadTeam[] = [];
  // Each team is a table row.
  const rows = html.split(/<tr[\s>]/i).slice(1);
  for (const rowRaw of rows) {
    const row = rowRaw.slice(0, rowRaw.search(/<\/tr>/i));
    // Species: Champions sprite filenames, in order, deduped, capped at 6.
    const spriteMatches = [
      ...row.matchAll(/gen9-champions\/([a-z0-9][a-z0-9-]*)\.(?:png|gif|webp)/gi),
    ];
    const species: string[] = [];
    for (const m of spriteMatches) {
      const sp = spriteStemToSpecies(m[1]);
      if (sp && !species.includes(sp)) species.push(sp);
      if (species.length >= 6) break;
    }
    if (species.length < 4) continue; // not a team row

    // Rental code — a Pokémon HOME-style code is 8-10 uppercase alphanumerics.
    const rentalCode = row.match(/\b([A-Z0-9]{8,10})\b/)?.[1] ?? null;
    const twitter = row.match(/twitter\.com\/([A-Za-z0-9_]+)/i)?.[1] ?? null;
    // Row text reads "Full Name ( handle ) Tournament Placement (date)".
    const text = row.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const m = text.match(/^([^()]+?)\s*\(\s*[^)]*\)\s*(.*)$/);
    const author = (m && m[1].trim()) || (twitter ? `@${twitter}` : null);
    const record = (m && m[2].trim()) || null;

    teams.push({ species, author, record, rentalCode });
  }
  return teams;
}

export async function aggregateFromVictoryRoad(
  opts: AggregateVictoryRoadOptions = {},
): Promise<AggregateVictoryRoadResult> {
  const url = opts.url ?? VICTORY_ROAD_REPLICA_URL;
  const internalFormat = opts.internalFormat ?? ACTIVE_REGULATION_FORMAT_ID;
  const limit = opts.limit ?? Number.POSITIVE_INFINITY;

  const result: AggregateVictoryRoadResult = {
    teamsConsidered: 0,
    teamsInserted: 0,
    teamsSkipped: 0,
    errors: [],
  };

  const html = await fetchHtml(url, opts.fetchTimeoutMs);
  if (!html) {
    result.errors.push({
      team: null,
      error: "Failed to fetch the Victory Road Champions Replica page.",
    });
    return result;
  }

  const teams = parseVictoryRoadReplica(html);
  let processed = 0;
  for (const team of teams) {
    if (processed >= limit) break;
    if (team.species.length < 4) {
      result.teamsSkipped += 1;
      continue;
    }
    result.teamsConsidered += 1;
    processed += 1;
    try {
      await upsertMetaTeam({
        source: "victoryroad",
        sourceRef: team.rentalCode,
        sourceUrl: url,
        format: internalFormat,
        author: team.author,
        record: team.record,
        archetype: null,
        description: team.rentalCode ? `Rental code: ${team.rentalCode}` : null,
        species: team.species,
        pokemon: [], // species-only; no full sets published on the page
        // Curated champion-credited teams — high trust, just under Limitless.
        trust: 0.9,
        seenAt: null,
      });
      result.teamsInserted += 1;
    } catch (err) {
      result.errors.push({
        team: team.author ?? team.rentalCode ?? null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
