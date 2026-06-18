/**
 * Limitless VGC tournament data client (SERVER-ONLY).
 *
 * Fetches tournament listings and standings (with full team lists) from
 * the Limitless TCG API for Champions VGC (Reg M-A) events.
 *
 * Do NOT import this file from client components — it uses the `server-only`
 * guard and should stay out of client bundles.
 */
import "server-only";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LimitlessTournament {
  id: string;
  name: string;
  date: string;
  format: string;
  players: number;
}

export interface LimitlessPokemon {
  species: string;
  item: string;
  ability: string;
  moves: string[];
  tera: string;
}

export interface LimitlessStanding {
  name: string;
  country: string;
  placement: number;
  team: LimitlessPokemon[];
}

export interface LimitlessUsageEntry {
  species: string;
  usagePercent: number;
  totalAppearances: number;
  totalTeams: number;
}

export interface LimitlessPokemonDetail {
  species: string;
  appearances: number;
  moves: { name: string; usage: number }[];
  items: { name: string; usage: number }[];
  abilities: { name: string; usage: number }[];
  teraTypes: { name: string; usage: number }[];
  teammates: { name: string; usage: number }[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LIMITLESS_BASE = "https://play.limitlesstcg.com/api";
const USER_AGENT = "MetaGross/1.0 (VGC analysis tool)";
const LIMITLESS_TIMEOUT_MS = 5000;

/**
 * fetch() with an AbortController-based timeout so a Limitless DNS/connect
 * hang can't block the agent for 10s+. Returns null on timeout or network
 * error — callers already handle null by falling back to cached/empty data.
 */
async function timedFetch(
  url: string,
  timeoutMs: number = LIMITLESS_TIMEOUT_MS,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
  } catch (err) {
    const reason = (err as Error).name === "AbortError"
      ? `timeout (${timeoutMs}ms)`
      : (err as Error).message;
    console.error(`[limitless] fetch failed for ${url}: ${reason}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// In-memory cache (24-hour TTL)
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const tournamentsCache = new Map<string, CacheEntry<LimitlessTournament[]>>();
const standingsCache = new Map<string, CacheEntry<LimitlessStanding[]>>();
const usageCache = new Map<string, CacheEntry<LimitlessUsageEntry[]>>();
const detailCache = new Map<string, CacheEntry<LimitlessPokemonDetail>>();

function getCached<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
    return entry.data;
  }
  return null;
}

function setCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  data: T,
): void {
  cache.set(key, { data, fetchedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Normalise species name: capitalise first letter, lowercase rest. */
function normaliseSpecies(raw: string): string {
  if (!raw) return raw;
  // Handle multi-word names like "Iron Hands" — capitalise each word
  return raw
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Map a raw Limitless decklist entry to our LimitlessPokemon type.
 */
function mapDecklistEntry(entry: {
  id?: string;
  name?: string;
  item?: string;
  ability?: string;
  attacks?: string[];
  tera?: string;
}): LimitlessPokemon {
  return {
    species: normaliseSpecies(entry.name ?? entry.id ?? "Unknown"),
    item: entry.item ?? "",
    ability: entry.ability ?? "",
    moves: entry.attacks ?? [],
    tera: entry.tera ?? "",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Regulation tournament codes Limitless uses, newest first. */
const LIMITLESS_REG_CODES = ["M-B", "M-A"] as const;

/** Fetch + normalise tournaments for one Limitless regulation code. */
async function fetchTournamentsByFormat(
  regCode: string,
): Promise<LimitlessTournament[]> {
  const url = `${LIMITLESS_BASE}/tournaments?game=VGC&format=${encodeURIComponent(regCode)}`;
  const response = await timedFetch(url);
  if (!response) return [];

  if (!response.ok) {
    console.error(
      `[limitless] Failed to fetch ${regCode} tournaments: ${response.status}`,
    );
    return [];
  }

  const raw: Array<{
    id?: string;
    name?: string;
    date?: string;
    format?: string;
    players?: number;
  }> = await response.json();

  return raw.map((t) => ({
    id: String(t.id ?? ""),
    name: t.name ?? "Unknown Tournament",
    date: t.date ?? "",
    format: t.format ?? regCode,
    players: t.players ?? 0,
  }));
}

/**
 * Get recent Champions tournaments from Limitless.
 *
 * Targets the active regulation (M-B) first and falls back to the previous
 * regulation (M-A) when Limitless hasn't published M-B events yet — expected
 * early in a new season.
 * TODO: drop the M-A fallback once M-B tournament data is live on Limitless.
 */
export async function getChampionsTournaments(): Promise<
  LimitlessTournament[]
> {
  const cacheKey = "champions-active";
  const cached = getCached(tournamentsCache, cacheKey);
  if (cached) return cached;

  try {
    let tournaments: LimitlessTournament[] = [];
    for (const regCode of LIMITLESS_REG_CODES) {
      tournaments = await fetchTournamentsByFormat(regCode);
      if (tournaments.length > 0) {
        if (regCode !== LIMITLESS_REG_CODES[0]) {
          console.info(
            `[limitless] No ${LIMITLESS_REG_CODES[0]} tournaments yet — falling back to ${regCode}.`,
          );
        }
        break;
      }
    }

    // Sort by date descending (most recent first)
    tournaments.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    if (tournaments.length > 0) {
      setCache(tournamentsCache, cacheKey, tournaments);
    }

    return tournaments;
  } catch (err) {
    console.error("[limitless] Error fetching tournaments:", err);
    return [];
  }
}

/**
 * Get standings + team lists for a specific tournament.
 */
export async function getTournamentStandings(
  tournamentId: string,
): Promise<LimitlessStanding[]> {
  const cacheKey = `standings:${tournamentId}`;
  const cached = getCached(standingsCache, cacheKey);
  if (cached) return cached;

  try {
    const url = `${LIMITLESS_BASE}/tournaments/${encodeURIComponent(tournamentId)}/standings`;
    const response = await timedFetch(url);
    if (!response) return [];

    if (!response.ok) {
      console.error(
        `[limitless] Failed to fetch standings for ${tournamentId}: ${response.status}`,
      );
      return [];
    }

    const raw: Array<{
      name?: string;
      country?: string;
      decklist?: Array<{
        id?: string;
        name?: string;
        item?: string;
        ability?: string;
        attacks?: string[];
        tera?: string;
      }>;
    }> = await response.json();

    const standings: LimitlessStanding[] = raw.map((entry, index) => ({
      name: entry.name ?? "Unknown",
      country: entry.country ?? "",
      placement: index + 1,
      team: (entry.decklist ?? []).map(mapDecklistEntry),
    }));

    if (standings.length > 0) {
      setCache(standingsCache, cacheKey, standings);
    }

    return standings;
  } catch (err) {
    console.error(
      `[limitless] Error fetching standings for ${tournamentId}:`,
      err,
    );
    return [];
  }
}

/**
 * Aggregate usage from recent tournaments.
 *
 * Fetches the last `limit` tournaments, pulls their standings, and
 * calculates which Pokemon appear most frequently across all teams.
 */
export async function getTournamentUsage(
  limit: number = 8,
): Promise<LimitlessUsageEntry[]> {
  const cacheKey = `usage:${limit}`;
  const cached = getCached(usageCache, cacheKey);
  if (cached) return cached;

  try {
    const tournaments = await getChampionsTournaments();
    const recentTournaments = tournaments.slice(0, limit);

    if (recentTournaments.length === 0) return [];

    // Fetch all standings in parallel
    const allStandings = await Promise.all(
      recentTournaments.map((t) => getTournamentStandings(t.id)),
    );

    // Count appearances: how many teams include each species
    const speciesCounts = new Map<string, number>();
    let totalTeams = 0;

    for (const standings of allStandings) {
      // Only consider teams that have a decklist
      const teamsWithLists = standings.filter((s) => s.team.length > 0);
      totalTeams += teamsWithLists.length;

      for (const standing of teamsWithLists) {
        const seen = new Set<string>();
        for (const mon of standing.team) {
          const species = mon.species;
          if (!seen.has(species)) {
            seen.add(species);
            speciesCounts.set(species, (speciesCounts.get(species) ?? 0) + 1);
          }
        }
      }
    }

    if (totalTeams === 0) return [];

    const entries: LimitlessUsageEntry[] = Array.from(speciesCounts.entries())
      .map(([species, count]) => ({
        species,
        usagePercent: Math.round((count / totalTeams) * 10000) / 100,
        totalAppearances: count,
        totalTeams,
      }))
      .sort((a, b) => b.usagePercent - a.usagePercent);

    setCache(usageCache, cacheKey, entries);
    return entries;
  } catch (err) {
    console.error("[limitless] Error aggregating tournament usage:", err);
    return [];
  }
}

/**
 * Get detailed move/item/ability/tera/teammate usage for a specific
 * Pokemon from tournament data.
 */
export async function getTournamentPokemonDetail(
  species: string,
): Promise<LimitlessPokemonDetail | null> {
  const cacheKey = `detail:${species}`;
  const cached = getCached(detailCache, cacheKey);
  if (cached) return cached;

  try {
    const tournaments = await getChampionsTournaments();
    const recentTournaments = tournaments.slice(0, 8);

    if (recentTournaments.length === 0) return null;

    const allStandings = await Promise.all(
      recentTournaments.map((t) => getTournamentStandings(t.id)),
    );

    const moveCounts = new Map<string, number>();
    const itemCounts = new Map<string, number>();
    const abilityCounts = new Map<string, number>();
    const teraCounts = new Map<string, number>();
    const teammateCounts = new Map<string, number>();
    let appearances = 0;

    const speciesLower = species.toLowerCase();

    for (const standings of allStandings) {
      for (const standing of standings) {
        const pokemonEntry = standing.team.find(
          (m) => m.species.toLowerCase() === speciesLower,
        );
        if (!pokemonEntry) continue;

        appearances++;

        // Count moves
        for (const move of pokemonEntry.moves) {
          if (move) moveCounts.set(move, (moveCounts.get(move) ?? 0) + 1);
        }

        // Count items
        if (pokemonEntry.item) {
          itemCounts.set(
            pokemonEntry.item,
            (itemCounts.get(pokemonEntry.item) ?? 0) + 1,
          );
        }

        // Count abilities
        if (pokemonEntry.ability) {
          abilityCounts.set(
            pokemonEntry.ability,
            (abilityCounts.get(pokemonEntry.ability) ?? 0) + 1,
          );
        }

        // Count tera types
        if (pokemonEntry.tera) {
          teraCounts.set(
            pokemonEntry.tera,
            (teraCounts.get(pokemonEntry.tera) ?? 0) + 1,
          );
        }

        // Count teammates
        for (const teammate of standing.team) {
          if (teammate.species.toLowerCase() !== speciesLower) {
            teammateCounts.set(
              teammate.species,
              (teammateCounts.get(teammate.species) ?? 0) + 1,
            );
          }
        }
      }
    }

    if (appearances === 0) return null;

    function toSortedUsage(
      counts: Map<string, number>,
    ): { name: string; usage: number }[] {
      return Array.from(counts.entries())
        .map(([name, count]) => ({
          name,
          usage: Math.round((count / appearances) * 10000) / 100,
        }))
        .sort((a, b) => b.usage - a.usage);
    }

    const detail: LimitlessPokemonDetail = {
      species,
      appearances,
      moves: toSortedUsage(moveCounts),
      items: toSortedUsage(itemCounts),
      abilities: toSortedUsage(abilityCounts),
      teraTypes: toSortedUsage(teraCounts),
      teammates: toSortedUsage(teammateCounts),
    };

    setCache(detailCache, cacheKey, detail);
    return detail;
  } catch (err) {
    console.error(
      `[limitless] Error fetching detail for ${species}:`,
      err,
    );
    return null;
  }
}
