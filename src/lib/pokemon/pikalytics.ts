/**
 * Pikalytics AI endpoint data client (SERVER-ONLY).
 *
 * Parses Pikalytics' machine-readable Markdown endpoints to fetch
 * competitive VGC usage statistics. The Champions endpoint ("championspreview")
 * tracks the current Champions meta (Reg M-B) and is the default format.
 *
 * Do NOT import this file from client components — it uses the `server-only`
 * guard and should stay out of client bundles.
 */
import "server-only";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PikalyticsUsageEntry {
  rank: number;
  species: string;
  usagePercent: number;
  webUrl: string;
  aiUrl: string;
}

export interface PikalyticsPokemonDetail {
  species: string;
  format: string;
  dataDate: string;
  moves: { name: string; usage: number }[];
  abilities: { name: string; usage: number }[];
  items: { name: string; usage: number }[];
  teammates: { name: string; usage: number }[];
  featuredTeams: {
    player: string;
    record: string;
    pokemon: string[];
    set?: { ability: string; item: string; moves: string[] };
  }[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIKALYTICS_BASE = "https://www.pikalytics.com/ai/pokedex";

export const PIKALYTICS_FORMATS = [
  // "championspreview" is Pikalytics' generic Champions endpoint — it tracks
  // the CURRENT Champions meta (now Reg M-B), so it auto-updates across
  // regulations without an id change.
  { id: "championspreview", label: "Champions Reg M-B (Current)" },
  { id: "gen9vgc2026regf", label: "VGC 2026 Reg F" },
  { id: "gen9vgc2025regi", label: "VGC 2025 Reg I" },
] as const;

export const DEFAULT_PIKALYTICS_FORMAT = "championspreview";

export const PIKALYTICS_FORMAT_IDS: Set<string> = new Set(
  PIKALYTICS_FORMATS.map((f) => f.id),
);

/**
 * Resolve any incoming format (a UI label like "Champions Reg M-B", an
 * internal id like "champions-reg-m-b", or an already-valid Pikalytics id
 * like "championspreview") to a Pikalytics format id. Pikalytics exposes a
 * single Champions endpoint that tracks the current meta, so every
 * Champions regulation maps to "championspreview".
 *
 * Without this, callers that pass a team's display format (e.g. the team
 * suggester) hit pikalytics.com/.../Champions%20Reg%20M-B → 404 → no data.
 */
export function resolvePikalyticsFormat(format?: string | null): string {
  if (!format) return DEFAULT_PIKALYTICS_FORMAT;
  const f = format.trim();
  if (PIKALYTICS_FORMAT_IDS.has(f)) return f;
  const lc = f.toLowerCase();
  if (lc.includes("champion")) return "championspreview";
  if (lc.includes("reg-f") || lc.includes("reg f")) return "gen9vgc2026regf";
  if (lc.includes("reg-i") || lc.includes("reg i")) return "gen9vgc2025regi";
  return DEFAULT_PIKALYTICS_FORMAT;
}

// ---------------------------------------------------------------------------
// In-memory cache (24-hour TTL)
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes when Pikalytics is unreachable
const FETCH_TIMEOUT_MS = 3000; // give up on a single request after 3s

const topUsageCache = new Map<string, CacheEntry<PikalyticsUsageEntry[]>>();
const detailCache = new Map<string, CacheEntry<PikalyticsPokemonDetail>>();
// Negative cache: keys in here will short-circuit immediately until TTL expires.
const negativeCache = new Map<string, number>();

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

function isNegCached(key: string): boolean {
  const until = negativeCache.get(key);
  if (!until) return false;
  if (Date.now() > until) {
    negativeCache.delete(key);
    return false;
  }
  return true;
}

function markUnreachable(key: string): void {
  negativeCache.set(key, Date.now() + NEGATIVE_CACHE_TTL_MS);
}

/**
 * Classify a fetch error: true if it's a transient network failure
 * (timeout, DNS, connection refused). We suppress the noisy stack for
 * these and mark the host as unreachable for a short window.
 */
function isNetworkError(err: unknown): boolean {
  const e = err as { code?: string; name?: string; cause?: { code?: string } };
  if (!e) return false;
  if (e.name === "AbortError") return true;
  const code = e.code ?? e.cause?.code;
  return (
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ECONNRESET" ||
    code === "EAI_AGAIN"
  );
}

/**
 * Wrap fetch with an AbortController timeout so we never hang on a
 * blocked/offline Pikalytics host.
 */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { "User-Agent": "MetaGross/1.0 (VGC analysis tool)" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Markdown parsers
// ---------------------------------------------------------------------------

/**
 * Parse the top-usage Markdown table.
 *
 * Expected row format:
 * | 1 | **Incineroar** | 48.27% | [View](url) | [AI](url) |
 */
function parseTopUsageMarkdown(md: string): PikalyticsUsageEntry[] {
  const entries: PikalyticsUsageEntry[] = [];
  const lines = md.split("\n");

  for (const line of lines) {
    // Match table rows: | rank | **Species** | usage% | [View](url) | [AI](url) |
    const match = line.match(
      /\|\s*(\d+)\s*\|\s*\*\*(.+?)\*\*\s*\|\s*([\d.]+)%\s*\|\s*\[View\]\((.+?)\)\s*\|\s*\[AI\]\((.+?)\)\s*\|/,
    );
    if (match) {
      entries.push({
        rank: parseInt(match[1], 10),
        species: match[2].trim(),
        usagePercent: parseFloat(match[3]),
        webUrl: match[4],
        aiUrl: match[5],
      });
    }
  }

  return entries;
}

/**
 * Parse a section of `- **Name**: value%` lines.
 * Returns array of { name, usage } sorted by usage descending.
 */
function parsePercentSection(
  md: string,
  sectionHeader: string,
): { name: string; usage: number }[] {
  const entries: { name: string; usage: number }[] = [];

  // Find the section
  const headerIndex = md.indexOf(`## ${sectionHeader}`);
  if (headerIndex === -1) return entries;

  // Get text from header to the next ## section or end
  const afterHeader = md.slice(headerIndex + sectionHeader.length + 3);
  const nextSection = afterHeader.indexOf("\n## ");
  const sectionText =
    nextSection === -1 ? afterHeader : afterHeader.slice(0, nextSection);

  const lines = sectionText.split("\n");
  for (const line of lines) {
    // Match: - **Name**: 41.092%
    const match = line.match(/^-\s+\*\*(.+?)\*\*:\s*([\d.]+)%/);
    if (match) {
      entries.push({
        name: match[1].trim(),
        usage: parseFloat(match[2]),
      });
    }
  }

  return entries;
}

/**
 * Parse the Featured Teams section.
 *
 * Each team block:
 * ### Team N by PlayerName
 * *Record: W - L - T*
 * **Pokemon**: Mon1, Mon2, Mon3, Mon4, Mon5, Mon6
 * **Species Set**:
 * - **Ability**: AbilityName
 * - **Item**: ItemName
 * - **Moves**: Move1, Move2, Move3, Move4
 */
function parseFeaturedTeams(
  md: string,
  species: string,
): PikalyticsPokemonDetail["featuredTeams"] {
  const teams: PikalyticsPokemonDetail["featuredTeams"] = [];

  // Find the featured teams section
  const headerPattern = `## Featured Teams with ${species}`;
  const headerIndex = md.indexOf(headerPattern);
  if (headerIndex === -1) {
    // Try a more relaxed search
    const altIndex = md.indexOf("## Featured Teams");
    if (altIndex === -1) return teams;
    return parseFeaturedTeamsFromBlock(
      md.slice(altIndex),
    );
  }

  return parseFeaturedTeamsFromBlock(
    md.slice(headerIndex),
  );
}

function parseFeaturedTeamsFromBlock(
  block: string,
): PikalyticsPokemonDetail["featuredTeams"] {
  const teams: PikalyticsPokemonDetail["featuredTeams"] = [];

  // Cut off at the next top-level ## section that isn't a team sub-header
  const nextTopSection = block.indexOf("\n## ", 5);
  const sectionText =
    nextTopSection === -1 ? block : block.slice(0, nextTopSection);

  // Split by ### Team headers
  const teamBlocks = sectionText.split(/### Team \d+ by /);

  for (let i = 1; i < teamBlocks.length; i++) {
    const teamBlock = teamBlocks[i];
    const lines = teamBlock.split("\n").map((l) => l.trim());

    // First line is player name
    const player = lines[0]?.trim() ?? "Unknown";

    // Parse record
    let record = "";
    const recordLine = lines.find((l) => l.startsWith("*Record:"));
    if (recordLine) {
      const recordMatch = recordLine.match(/\*Record:\s*(.+?)\*/);
      if (recordMatch) record = recordMatch[1].trim();
    }

    // Parse Pokemon list
    let pokemon: string[] = [];
    const pokemonLine = lines.find((l) => l.startsWith("**Pokemon**:"));
    if (pokemonLine) {
      const pokemonStr = pokemonLine.replace("**Pokemon**:", "").trim();
      pokemon = pokemonStr.split(",").map((p) => p.trim()).filter(Boolean);
    }

    // Parse set details
    let set: { ability: string; item: string; moves: string[] } | undefined;
    const abilityLine = lines.find((l) => l.match(/^\*?\*?\s*-\s*\*\*Ability\*\*/));
    const itemLine = lines.find((l) => l.match(/^\*?\*?\s*-\s*\*\*Item\*\*/));
    const movesLine = lines.find((l) => l.match(/^\*?\*?\s*-\s*\*\*Moves\*\*/));

    if (abilityLine || itemLine || movesLine) {
      const ability = abilityLine
        ? (abilityLine.match(/\*\*Ability\*\*:\s*(.+)/)?.[1]?.trim() ?? "")
        : "";
      const item = itemLine
        ? (itemLine.match(/\*\*Item\*\*:\s*(.+)/)?.[1]?.trim() ?? "")
        : "";
      const movesStr = movesLine
        ? (movesLine.match(/\*\*Moves\*\*:\s*(.+)/)?.[1]?.trim() ?? "")
        : "";
      const moves = movesStr
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      set = { ability, item, moves };
    }

    teams.push({ player, record, pokemon, set });
  }

  return teams;
}

/**
 * Parse the data date from the Quick Info table.
 */
function parseDataDate(md: string): string {
  const match = md.match(/\*\*Data Date\*\*\s*\|\s*(\S+)/);
  return match?.[1] ?? "";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch top 50 Pokemon usage for a Pikalytics format.
 */
export async function getPikalyticsTopUsage(
  format: string = DEFAULT_PIKALYTICS_FORMAT,
): Promise<PikalyticsUsageEntry[]> {
  const cacheKey = format;
  const cached = getCached(topUsageCache, cacheKey);
  if (cached) return cached;
  if (isNegCached(`top:${format}`)) return [];

  try {
    const url = `${PIKALYTICS_BASE}/${encodeURIComponent(format)}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.error(
        `[pikalytics] Failed to fetch top usage for ${format}: ${response.status}`,
      );
      markUnreachable(`top:${format}`);
      return [];
    }

    const md = await response.text();
    const entries = parseTopUsageMarkdown(md);
    if (entries.length > 0) {
      setCache(topUsageCache, cacheKey, entries);
    }
    return entries;
  } catch (err) {
    if (isNetworkError(err)) {
      // Quiet one-line warning — Pikalytics unreachable from this host.
      console.warn(
        `[pikalytics] unreachable (top-usage ${format}); using fallback for ${NEGATIVE_CACHE_TTL_MS / 1000}s`,
      );
      markUnreachable(`top:${format}`);
      return [];
    }
    console.error(`[pikalytics] Error fetching top usage for ${format}:`, err);
    return [];
  }
}

/**
 * Fetch detailed stats for a specific Pokemon in a Pikalytics format.
 */
export async function getPikalyticsPokemonDetail(
  species: string,
  format: string = DEFAULT_PIKALYTICS_FORMAT,
): Promise<PikalyticsPokemonDetail | null> {
  const cacheKey = `${format}:${species}`;
  const cached = getCached(detailCache, cacheKey);
  if (cached) return cached;
  // If the whole host is unreachable, short-circuit every detail lookup
  // too — no point hammering per-species when the top-level already failed.
  if (isNegCached(`top:${format}`) || isNegCached(`detail:${cacheKey}`)) {
    return null;
  }

  try {
    const url = `${PIKALYTICS_BASE}/${encodeURIComponent(format)}/${encodeURIComponent(species)}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      if (response.status === 404) {
        // Not a transient failure — cache "null" for the full TTL so we
        // don't retry a species that simply isn't on Pikalytics.
        markUnreachable(`detail:${cacheKey}`);
      } else {
        console.error(
          `[pikalytics] Failed to fetch detail for ${species} in ${format}: ${response.status}`,
        );
      }
      return null;
    }

    const md = await response.text();

    const detail: PikalyticsPokemonDetail = {
      species,
      format,
      dataDate: parseDataDate(md),
      moves: parsePercentSection(md, "Common Moves"),
      abilities: parsePercentSection(md, "Common Abilities"),
      items: parsePercentSection(md, "Common Items"),
      teammates: parsePercentSection(md, "Common Teammates"),
      featuredTeams: parseFeaturedTeams(md, species),
    };

    setCache(detailCache, cacheKey, detail);
    return detail;
  } catch (err) {
    if (isNetworkError(err)) {
      // Mark the whole host unreachable — any other species we try will
      // fail the same way until the circuit opens.
      markUnreachable(`top:${format}`);
      markUnreachable(`detail:${cacheKey}`);
      console.warn(
        `[pikalytics] unreachable (detail ${species}/${format}); using fallback for ${NEGATIVE_CACHE_TTL_MS / 1000}s`,
      );
      return null;
    }
    console.error(
      `[pikalytics] Error fetching detail for ${species} in ${format}:`,
      err,
    );
    return null;
  }
}
