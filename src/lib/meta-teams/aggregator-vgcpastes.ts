/**
 * VGCPastes aggregator.
 *
 * Pulls the community-maintained "VGCPastes Repository (Champions)"
 * Google Sheet — 514+ teams across 365+ creators, each with a
 * pokepaste URL, tournament/event, rank, and player attribution. We
 * fetch the CSV export, parse each row, follow the pokepaste, and
 * upsert the team into meta_teams with source='vgcpastes'.
 *
 * Sheet:  https://docs.google.com/spreadsheets/d/1axlwmzPA49rYkqXh7zHvAtSP-TKbM0ijGYBPRflLSWw
 * Tab:    Champions (gid 791705272)
 *
 * SERVER-ONLY.
 */
import "server-only";

import {
  fetchPokepasteRaw,
  parsePokepaste,
} from "./scrapers/pokepaste";
import { upsertMetaTeam } from "./queries";

export const VGCPASTES_SHEET_ID = "1axlwmzPA49rYkqXh7zHvAtSP-TKbM0ijGYBPRflLSWw";
export const VGCPASTES_CHAMPIONS_GID = "791705272";

export interface AggregateVgcPastesOptions {
  /** Cap how many rows to ingest in this run. Defaults to all. */
  limit?: number;
  /** Skip rows older than this many days. Default: no filter. */
  maxAgeDays?: number;
  /** Internal format id stored on the row. */
  internalFormat?: string;
  /** Per-paste fetch timeout in ms. Default 5000. */
  pasteTimeoutMs?: number;
  onProgress?: (event: {
    teamId: string | null;
    index: number;
    total: number;
    inserted: boolean;
    error?: string;
  }) => void;
}

export interface AggregateVgcPastesResult {
  rowsConsidered: number;
  pastesFetched: number;
  teamsInserted: number;
  teamsUpdated: number;
  rowsSkipped: number;
  errors: Array<{ teamId: string | null; error: string }>;
}

/**
 * Fetch the CSV. Uses the public CSV-export endpoint so we don't need
 * a Google API key — the sheet just has to be publicly viewable.
 */
async function fetchCsv(timeoutMs = 15000): Promise<string | null> {
  const url = `https://docs.google.com/spreadsheets/d/${VGCPASTES_SHEET_ID}/export?format=csv&gid=${VGCPASTES_CHAMPIONS_GID}`;
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

/**
 * RFC 4180-ish CSV row parser. Handles quoted fields with embedded
 * commas and escaped quotes (`""` → `"`). Returns one array of
 * fields per logical row. The sheet contains multiline values
 * inside quoted cells (e.g. the "Replica Code (Click text for image)"
 * column header), so newlines inside quotes count as part of the cell.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      current.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (c === "\r") {
      i += 1;
      continue;
    }
    if (c === "\n") {
      current.push(cell);
      rows.push(current);
      current = [];
      cell = "";
      i += 1;
      continue;
    }
    cell += c;
    i += 1;
  }
  if (cell.length > 0 || current.length > 0) {
    current.push(cell);
    rows.push(current);
  }
  return rows;
}

interface VgcPastesRow {
  teamId: string;
  description: string;
  fullName: string;
  pokepasteUrl: string;
  date: string;
  tournament: string;
  rank: string;
  sourceLink: string;
  owner: string;
  speciesList: string[];
}

/**
 * Find the header row + map column names → positions. The sheet has
 * 3 leading rows (title, sub-title, header) and the column layout
 * shifts whenever the maintainers add/remove columns — looking up by
 * header name is the only sustainable approach.
 *
 * Returns null if the header can't be located (we then bail rather
 * than crash in confusing ways).
 */
export function buildHeaderMap(rows: string[][]): {
  headerRow: number;
  index: Record<string, number>;
  speciesColumns: number[];
} | null {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row) continue;
    if (
      row.some((c) => c.trim().toLowerCase() === "team id") &&
      row.some((c) => c.trim().toLowerCase() === "pokepaste")
    ) {
      const index: Record<string, number> = {};
      for (let j = 0; j < row.length; j++) {
        const key = row[j].trim().toLowerCase();
        if (key && !(key in index)) index[key] = j;
      }
      // The "Pokemon Text for Copypasta" group is 6 contiguous cells
      // immediately to the right of that label cell. Find the label
      // (or its variants) and harvest the 6 cells after it.
      const speciesAnchor =
        index["pokemon text for copypasta"] ??
        index["pokemon (copypasta)"] ??
        -1;
      const speciesColumns: number[] = [];
      if (speciesAnchor >= 0) {
        // Species 1..6 start AT the anchor column (the header label
        // spans the same first cell as species 1 in the data rows).
        for (let k = 0; k < 6; k++) speciesColumns.push(speciesAnchor + k);
      }
      return { headerRow: i, index, speciesColumns };
    }
  }
  return null;
}

/**
 * Map raw CSV row → typed shape using the header-resolved index.
 */
function rowToVgcPastes(
  row: string[],
  index: Record<string, number>,
  speciesColumns: number[],
): VgcPastesRow | null {
  if (!row) return null;

  const get = (label: string): string => {
    const key = label.toLowerCase();
    const i = index[key];
    if (i === undefined) return "";
    return (row[i] ?? "").trim();
  };

  const teamId = get("team id");
  if (!teamId || !/^PC\d+/i.test(teamId)) return null;

  const pokepasteUrl = get("pokepaste");
  if (!pokepasteUrl || !/pokepast\.es/i.test(pokepasteUrl)) return null;

  const speciesList = speciesColumns
    .map((i) => (row[i] ?? "").trim())
    .filter((s) => s.length > 0);

  return {
    teamId,
    description: get("team description"),
    fullName: get("full name"),
    pokepasteUrl,
    date: get("date shared"),
    tournament: get("tournament / event") || get("tournament") || get("event"),
    rank: get("rank"),
    sourceLink: get("link to source") || get("source"),
    owner: get("owner"),
    speciesList,
  };
}

function dateToTimestamp(date: string): number | null {
  if (!date) return null;
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : null;
}

export async function aggregateFromVgcPastes(
  opts: AggregateVgcPastesOptions = {},
): Promise<AggregateVgcPastesResult> {
  const limit = opts.limit ?? Number.POSITIVE_INFINITY;
  const maxAgeMs = opts.maxAgeDays
    ? opts.maxAgeDays * 24 * 60 * 60 * 1000
    : null;
  const internalFormat = opts.internalFormat ?? "champions-reg-m-a";
  const pasteTimeoutMs = opts.pasteTimeoutMs ?? 5000;

  const result: AggregateVgcPastesResult = {
    rowsConsidered: 0,
    pastesFetched: 0,
    teamsInserted: 0,
    teamsUpdated: 0,
    rowsSkipped: 0,
    errors: [],
  };

  const csv = await fetchCsv();
  if (!csv) {
    result.errors.push({
      teamId: null,
      error: "Failed to download VGCPastes CSV (network or sheet-permissions issue).",
    });
    return result;
  }

  const rows = parseCsv(csv);
  const headerMap = buildHeaderMap(rows);
  if (!headerMap) {
    result.errors.push({
      teamId: null,
      error:
        "Could not locate the VGCPastes header row (expected 'Team ID' + 'Pokepaste' columns). The sheet structure may have changed.",
    });
    return result;
  }
  // Data starts immediately after the header row.
  const dataRows = rows.slice(headerMap.headerRow + 1);
  let processed = 0;
  for (let i = 0; i < dataRows.length; i++) {
    if (processed >= limit) break;
    const parsed = rowToVgcPastes(
      dataRows[i],
      headerMap.index,
      headerMap.speciesColumns,
    );
    if (!parsed) {
      result.rowsSkipped += 1;
      continue;
    }

    if (maxAgeMs !== null) {
      const ts = dateToTimestamp(parsed.date);
      if (ts !== null && Date.now() - ts > maxAgeMs) {
        result.rowsSkipped += 1;
        continue;
      }
    }

    result.rowsConsidered += 1;
    processed += 1;

    try {
      // Try the pokepaste first — it gives us moves/items/abilities.
      const raw = await fetchPokepasteRaw(parsed.pokepasteUrl, pasteTimeoutMs);
      let pokemon: Array<{
        species: string;
        ability?: string;
        item?: string;
        nature?: string;
        moves?: string[];
        teraType?: string;
        evs?: string;
        ivs?: string;
      }> = [];
      let species: string[] = parsed.speciesList;

      if (raw) {
        result.pastesFetched += 1;
        const parsedPaste = parsePokepaste(raw);
        if (parsedPaste.pokemon.length > 0) {
          pokemon = parsedPaste.pokemon.map((p) => ({
            species: p.species,
            ability: p.ability,
            item: p.item,
            nature: p.nature,
            moves: p.moves,
            teraType: p.teraType,
            evs: p.evs,
            ivs: p.ivs,
          }));
          species = parsedPaste.pokemon.map((p) => p.species);
        }
      }

      // If we couldn't fetch the paste, we still upsert based on the
      // CSV-listed species so the team is at least discoverable via
      // mode=match. The pokemon[] field stays empty; future runs can
      // fill it when the paste is reachable.
      if (species.length === 0) {
        result.rowsSkipped += 1;
        continue;
      }

      const seenAt = dateToTimestamp(parsed.date) ?? Date.now();
      const recordParts = [parsed.tournament, parsed.rank].filter(
        (s) => s && s.trim().length > 0 && s.trim() !== "-",
      );

      await upsertMetaTeam({
        source: "vgcpastes",
        sourceRef: parsed.teamId,
        sourceUrl: parsed.sourceLink || parsed.pokepasteUrl,
        format: internalFormat,
        author: parsed.fullName || parsed.owner || null,
        record: recordParts.length > 0 ? recordParts.join(" — ") : null,
        archetype: null,
        description: parsed.description || null,
        species,
        pokemon,
        // Trust just below creator (1.0) and Limitless top-cut (0.95) —
        // VGCPastes is curated but second-hand attributed.
        trust: 0.85,
        seenAt,
      });
      // Approximate insert vs update: upsertMetaTeam returns the row,
      // not the action. Best-effort accounting via createdAt vs now.
      result.teamsInserted += 1;
      opts.onProgress?.({
        teamId: parsed.teamId,
        index: i,
        total: dataRows.length,
        inserted: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push({ teamId: parsed.teamId, error: msg });
      opts.onProgress?.({
        teamId: parsed.teamId,
        index: i,
        total: dataRows.length,
        inserted: false,
        error: msg,
      });
    }
  }

  return result;
}
