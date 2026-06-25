/**
 * Labmaus aggregator (SCAFFOLD — needs verification).
 *
 * Labmaus (labmaus.net) is "the #1 VGC tournament analysis resource": official +
 * unofficial tournament team lists and usage stats, organised per tournament at
 * `labmaus.net/tournaments/{id}` (some events have 1000+ teams). Broader coverage
 * than Limitless's official-only events — a strong addition to the proven-team
 * pool.
 *
 * ⚠️ STATUS: NOT yet functional. Two things blocked finishing it in this session:
 *   1. labmaus.net presents an INCOMPLETE TLS certificate chain, so it could not
 *      be fetched from the dev environment (curl/WebFetch both failed with
 *      "unable to verify the first certificate"). The adapter must fetch with a
 *      lenient TLS path — see `fetchLabmaus` below.
 *   2. Labmaus is a client-rendered SPA; the team data is NOT in the initial HTML
 *      as a table. The real source is its internal data fetch (likely a JSON API
 *      the SPA calls, or a Next.js `__NEXT_DATA__` blob). The exact endpoint +
 *      shape must be discovered from a live page before the parser can be written.
 *
 * TODO(verify), once the dev shell + network are restored:
 *   - Open a tournament page in the browser, watch the network tab, and capture
 *     the data request (URL + JSON shape). Likely candidates:
 *       GET https://labmaus.net/api/tournaments/{id}        (REST JSON), or
 *       a `__NEXT_DATA__` <script id="__NEXT_DATA__"> blob in the HTML.
 *   - Implement `parseLabmaus` against that shape (team → players[].team[]).
 *   - Confirm the lenient-cert fetch is actually needed in prod (it may be a
 *     dev-env CA-bundle quirk, not a real chain problem).
 *
 * SERVER-ONLY.
 */
import "server-only";

import { upsertMetaTeam } from "./queries";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

export interface AggregateLabmausOptions {
  /** Tournament ids to ingest (labmaus.net/tournaments/{id}). */
  tournamentIds?: string[];
  internalFormat?: string;
  fetchTimeoutMs?: number;
}

export interface AggregateLabmausResult {
  tournamentsScanned: number;
  teamsInserted: number;
  teamsSkipped: number;
  errors: Array<{ tournament: string | null; error: string }>;
  /** True while the parser is still a stub. */
  notImplemented: boolean;
}

/**
 * Fetch a Labmaus URL. Labmaus's cert chain is incomplete, so a normal fetch
 * may throw "unable to verify the first certificate". If so, retry with a
 * lenient TLS dispatcher.
 *
 * TODO(verify): wire the lenient path. Node's global fetch (undici) takes a
 * `dispatcher`:
 *
 *   import { Agent } from "undici";
 *   const lenient = new Agent({ connect: { rejectUnauthorized: false } });
 *   return fetch(url, { dispatcher: lenient, signal });
 *
 * Left out here so the file compiles without assuming the `undici` package is a
 * direct dependency; add it when implementing.
 */
async function fetchLabmaus(
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
    // Likely the TLS chain issue — see the doc comment for the lenient retry.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse a Labmaus tournament page/payload into teams.
 * TODO(verify): implement against the real data shape (see file header).
 */
export function parseLabmaus(
  _payload: string,
): Array<{ species: string[]; author: string | null; record: string | null }> {
  // Not yet implemented — the SPA's data endpoint/shape must be captured first.
  return [];
}

export async function aggregateFromLabmaus(
  opts: AggregateLabmausOptions = {},
): Promise<AggregateLabmausResult> {
  const internalFormat = opts.internalFormat ?? ACTIVE_REGULATION_FORMAT_ID;
  const tournamentIds = opts.tournamentIds ?? [];

  const result: AggregateLabmausResult = {
    tournamentsScanned: 0,
    teamsInserted: 0,
    teamsSkipped: 0,
    errors: [],
    notImplemented: true,
  };

  for (const id of tournamentIds) {
    const html = await fetchLabmaus(
      `https://labmaus.net/tournaments/${id}`,
      opts.fetchTimeoutMs,
    );
    result.tournamentsScanned += 1;
    if (!html) {
      result.errors.push({
        tournament: id,
        error: "Fetch failed (likely the incomplete TLS cert chain — see header).",
      });
      continue;
    }
    const teams = parseLabmaus(html);
    if (teams.length === 0) {
      result.errors.push({
        tournament: id,
        error: "parseLabmaus not implemented yet — data shape needs verification.",
      });
      continue;
    }
    for (const team of teams) {
      if (team.species.length < 4) {
        result.teamsSkipped += 1;
        continue;
      }
      try {
        await upsertMetaTeam({
          source: "labmaus",
          sourceRef: id,
          sourceUrl: `https://labmaus.net/tournaments/${id}`,
          format: internalFormat,
          author: team.author,
          record: team.record,
          archetype: null,
          description: null,
          species: team.species,
          pokemon: [],
          trust: 0.85,
          seenAt: null,
        });
        result.teamsInserted += 1;
      } catch (err) {
        result.errors.push({
          tournament: id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return result;
}
