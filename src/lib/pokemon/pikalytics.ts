/**
 * Pikalytics AI endpoint data client (SERVER-ONLY).
 *
 * Parses Pikalytics' machine-readable Markdown endpoints to fetch
 * competitive VGC usage statistics. Champions Reg M-A is the default format.
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
  { id: "championspreview", label: "Champions Reg M-A (Current)" },
  { id: "gen9vgc2026regf", label: "VGC 2026 Reg F" },
  { id: "gen9vgc2025regi", label: "VGC 2025 Reg I" },
] as const;

export const DEFAULT_PIKALYTICS_FORMAT = "championspreview";

export const PIKALYTICS_FORMAT_IDS: Set<string> = new Set(
  PIKALYTICS_FORMATS.map((f) => f.id),
);

// ---------------------------------------------------------------------------
// In-memory cache (24-hour TTL)
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const topUsageCache = new Map<string, CacheEntry<PikalyticsUsageEntry[]>>();
const detailCache = new Map<string, CacheEntry<PikalyticsPokemonDetail>>();

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

  try {
    const url = `${PIKALYTICS_BASE}/${encodeURIComponent(format)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "MetaGross/1.0 (VGC analysis tool)" },
    });

    if (!response.ok) {
      console.error(
        `[pikalytics] Failed to fetch top usage for ${format}: ${response.status}`,
      );
      return [];
    }

    const md = await response.text();
    const entries = parseTopUsageMarkdown(md);
    if (entries.length > 0) {
      setCache(topUsageCache, cacheKey, entries);
    }
    return entries;
  } catch (err) {
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

  try {
    const url = `${PIKALYTICS_BASE}/${encodeURIComponent(format)}/${encodeURIComponent(species)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "MetaGross/1.0 (VGC analysis tool)" },
    });

    if (!response.ok) {
      console.error(
        `[pikalytics] Failed to fetch detail for ${species} in ${format}: ${response.status}`,
      );
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
    console.error(
      `[pikalytics] Error fetching detail for ${species} in ${format}:`,
      err,
    );
    return null;
  }
}
