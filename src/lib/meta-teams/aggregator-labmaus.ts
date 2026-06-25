/**
 * Labmaus aggregator (top teams, regulation-filtered).
 *
 * Labmaus (labmaus.net) is "the #1 VGC tournament analysis resource". Its
 * `/teams/top-teams` view is backed by a clean REST endpoint:
 *
 *   GET https://labmaus.net/api/top_teams
 *         ?regulation=<Regulation Set M-B>
 *         &date_range=<YYYY-MM-DD>+to+<YYYY-MM-DD>
 *         &language=en
 *
 * which returns the highest-placing tournament teams for that regulation —
 * each with the player, placement, record, tournament, the 6 species, AND a
 * pokepaste link to the FULL set (moves/items/EVs/tera). We import the species
 * skeleton + the pokepaste as the source URL so the builder can pull the exact
 * set. Crucially we pass `regulation=Regulation Set M-B`, so this is real
 * Champions Reg M-B data (megas, no restricted legendaries) — not the cartridge
 * VGC tournaments Labmaus also tracks.
 *
 * Two server-side wrinkles, both handled here:
 *   1. labmaus.net serves an INCOMPLETE TLS chain → Node's fetch throws
 *      "unable to verify the first certificate". We fetch through a lenient
 *      undici dispatcher (rejectUnauthorized:false). The data is public and
 *      read-only, so the downgrade only risks a MITM feeding bad team data —
 *      acceptable for an aggregation job.
 *   2. The API gates on the `Origin` header (returns 403 {error:"unauthorized"}
 *      otherwise), so we send labmaus.net's own Origin/Referer.
 *
 * SERVER-ONLY.
 */
import "server-only";
import { Agent } from "undici";

import { upsertMetaTeam } from "./queries";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

export const LABMAUS_TOP_TEAMS_ENDPOINT = "https://labmaus.net/api/top_teams";

/** Map our internal format id → Labmaus's `regulation` query value. */
const FORMAT_TO_LABMAUS_REGULATION: Record<string, string> = {
  "champions-reg-m-b": "Regulation Set M-B",
  "champions-reg-m-a": "Regulation Set M-A",
};

export interface AggregateLabmausOptions {
  internalFormat?: string;
  /** Override the Labmaus regulation string (else derived from internalFormat). */
  regulation?: string;
  /** How many days back to include (the API requires a date range). Default 35. */
  days?: number;
  /** Explicit "YYYY-MM-DD to YYYY-MM-DD" range; overrides `days`. */
  dateRange?: string;
  /** Cap teams ingested this run. Default all returned. */
  limit?: number;
  fetchTimeoutMs?: number;
}

export interface AggregateLabmausResult {
  regulation: string;
  dateRange: string;
  teamsConsidered: number;
  teamsInserted: number;
  teamsSkipped: number;
  errors: Array<{ team: string | null; error: string }>;
}

export interface LabmausTeam {
  species: string[];
  author: string | null;
  record: string | null;
  pokepasteUrl: string | null;
  tournament: string | null;
}

// Shape of the slice of the API payload we consume.
interface LabmausPlayerTeam {
  name?: string;
  placement?: number;
  pokemon_names?: string[];
  record?: string;
  team_url?: string;
  tournament_name?: string;
  tournament_id?: number;
}
interface LabmausCoreGroup {
  teams?: LabmausPlayerTeam[];
}
interface LabmausComposition {
  teams?: LabmausCoreGroup[];
}

const lenientTls = new Agent({ connect: { rejectUnauthorized: false } });

/** Labmaus display name → canonical (hyphenated, symbol-stripped) species, to
 *  match the form Limitless/Victory Road store and so Showdown sprites resolve
 *  ("Urshifu Rapid Strike" → "Urshifu-Rapid-Strike"). The meta_teams fingerprint
 *  normalises again for dedup, so this is mainly for display/import fidelity. */
export function normalizeLabmausSpecies(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[♀]/g, "-F")
    .replace(/[♂]/g, "-M")
    .replace(/[^A-Za-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Default date range: the last `days` days, ending today (UTC). */
function defaultDateRange(days: number): string {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  return `${fmt(start)} to ${fmt(end)}`;
}

async function fetchTopTeams(
  regulation: string,
  dateRange: string,
  timeoutMs: number,
): Promise<unknown> {
  const url =
    `${LABMAUS_TOP_TEAMS_ENDPOINT}?regulation=${encodeURIComponent(regulation)}` +
    `&date_range=${encodeURIComponent(dateRange)}&language=en`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // The API 403s without an Origin; lenient TLS clears the incomplete chain.
      dispatcher: lenientTls,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Origin: "https://labmaus.net",
        Referer: "https://labmaus.net/teams/top-teams",
      },
    } as RequestInit & { dispatcher: Agent });
    if (!res.ok) {
      throw new Error(`Labmaus top_teams HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Flatten the nested top_teams payload into individual player teams. */
export function parseLabmausTopTeams(payload: unknown): LabmausTeam[] {
  if (!Array.isArray(payload)) return [];
  const teams: LabmausTeam[] = [];
  for (const comp of payload as LabmausComposition[]) {
    for (const core of comp?.teams ?? []) {
      for (const player of core?.teams ?? []) {
        const species: string[] = [];
        for (const raw of player?.pokemon_names ?? []) {
          const sp = normalizeLabmausSpecies(String(raw));
          if (sp && !species.includes(sp)) species.push(sp);
          if (species.length >= 6) break;
        }
        if (species.length < 4) continue;

        const placement =
          typeof player.placement === "number" ? player.placement : null;
        const recordBits = [
          player.tournament_name?.trim(),
          player.record ? `${player.record}` : null,
          placement ? `#${placement}` : null,
        ].filter(Boolean);

        teams.push({
          species,
          author: player.name?.trim() || null,
          record: recordBits.length ? recordBits.join(" — ") : null,
          pokepasteUrl:
            typeof player.team_url === "string" ? player.team_url : null,
          tournament: player.tournament_name?.trim() || null,
        });
      }
    }
  }
  return teams;
}

export async function aggregateFromLabmaus(
  opts: AggregateLabmausOptions = {},
): Promise<AggregateLabmausResult> {
  const internalFormat = opts.internalFormat ?? ACTIVE_REGULATION_FORMAT_ID;
  const regulation =
    opts.regulation ??
    FORMAT_TO_LABMAUS_REGULATION[internalFormat] ??
    "Regulation Set M-B";
  const dateRange = opts.dateRange ?? defaultDateRange(opts.days ?? 35);
  const limit = opts.limit ?? Number.POSITIVE_INFINITY;

  const result: AggregateLabmausResult = {
    regulation,
    dateRange,
    teamsConsidered: 0,
    teamsInserted: 0,
    teamsSkipped: 0,
    errors: [],
  };

  let payload: unknown;
  try {
    payload = await fetchTopTeams(
      regulation,
      dateRange,
      opts.fetchTimeoutMs ?? 20000,
    );
  } catch (err) {
    result.errors.push({
      team: null,
      error: `Failed to fetch Labmaus top teams: ${
        err instanceof Error ? err.message : String(err)
      }`,
    });
    return result;
  }

  const teams = parseLabmausTopTeams(payload);
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
        source: "labmaus",
        sourceRef: team.pokepasteUrl ?? `${team.author ?? "?"}:${team.tournament ?? "?"}`,
        sourceUrl: team.pokepasteUrl,
        format: internalFormat,
        author: team.author,
        record: team.record,
        archetype: null,
        description: team.pokepasteUrl ? `Full set: ${team.pokepasteUrl}` : null,
        species: team.species,
        pokemon: [], // species-only; full set lives at the pokepaste link
        // Tournament-placing teams with a verifiable paste — high trust.
        trust: 0.9,
        seenAt: null,
      });
      result.teamsInserted += 1;
    } catch (err) {
      result.errors.push({
        team: team.author ?? team.pokepasteUrl ?? null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
