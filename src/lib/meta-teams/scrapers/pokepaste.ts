/**
 * Pokepaste parsing — extract the species list (and, when cheap,
 * per-Pokemon sets) from a raw Pokepaste text block.
 *
 * Pokepaste format (one Pokemon per blank-line-separated block):
 *
 *   Nickname (M) @ Damp Rock
 *   Ability: Drizzle
 *   Level: 50
 *   Tera Type: Water
 *   EVs: 252 HP / 4 Def / 252 SpA
 *   Modest Nature
 *   IVs: 0 Atk
 *   - Weather Ball
 *   - Hurricane
 *   - Tailwind
 *   - Protect
 *
 * The first line is "<Name or Nickname (gender)> @ <item>". The name
 * MAY be a nickname — in that case the species shows up as the
 * nickname's parenthesised annotation: "Beepboop (Lopunny) @ Lopunnite".
 * Our parser handles both.
 */

export interface ParsedPokepastePokemon {
  species: string;
  item?: string;
  ability?: string;
  nature?: string;
  moves?: string[];
  teraType?: string;
  /** Raw EV string as written ("252 HP / 4 Def / 252 SpA"). Optional —
   *  not every paste includes EVs. */
  evs?: string;
  /** Raw IV string ("0 Atk"). Pasted only when off the default 31. */
  ivs?: string;
  level?: number;
}

export interface ParsedPokepaste {
  pokemon: ParsedPokepastePokemon[];
  species: string[];
}

/**
 * Parse a Pokepaste raw text into species + optional sets.
 * Robust to trailing whitespace, Windows line-endings, and nickname
 * patterns like "Beepboop (Lopunny) @ Lopunnite".
 */
export function parsePokepaste(raw: string): ParsedPokepaste {
  const normalized = raw.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return { pokemon: [], species: [] };

  const blocks = normalized.split(/\n\s*\n+/);
  const pokemon: ParsedPokepastePokemon[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const firstLine = lines[0];
    const species = extractSpecies(firstLine);
    if (!species) continue;

    const mon: ParsedPokepastePokemon = { species };

    const afterAt = firstLine.split("@");
    if (afterAt.length > 1) {
      const item = afterAt.slice(1).join("@").trim();
      if (item) mon.item = item;
    }

    for (const line of lines.slice(1)) {
      if (line.startsWith("Ability:")) {
        mon.ability = line.slice("Ability:".length).trim();
      } else if (line.startsWith("Tera Type:")) {
        mon.teraType = line.slice("Tera Type:".length).trim();
      } else if (line.startsWith("EVs:")) {
        const v = line.slice("EVs:".length).trim();
        if (v) mon.evs = v;
      } else if (line.startsWith("IVs:")) {
        const v = line.slice("IVs:".length).trim();
        if (v) mon.ivs = v;
      } else if (line.startsWith("Level:")) {
        const lvl = parseInt(line.slice("Level:".length).trim(), 10);
        if (Number.isFinite(lvl) && lvl > 0) mon.level = lvl;
      } else if (line.endsWith("Nature")) {
        mon.nature = line.replace(/\s*Nature\s*$/, "").trim();
      } else if (line.startsWith("- ")) {
        const move = line.slice(2).trim();
        if (move) {
          mon.moves = mon.moves ? [...mon.moves, move] : [move];
        }
      }
    }

    pokemon.push(mon);
  }

  const species = pokemon.map((p) => p.species).filter(Boolean);
  return { pokemon, species };
}

/**
 * Extract the species from the first line of a Pokepaste block.
 * Handles:
 *   "Pelipper @ Damp Rock"                  → Pelipper
 *   "Pelipper (F) @ Damp Rock"              → Pelipper
 *   "Beepboop (Lopunny) @ Lopunnite"        → Lopunny (nickname → species)
 *   "Nickname (Lopunny) (M) @ Lopunnite"    → Lopunny
 *   "Lopunny-Mega"                          → Lopunny-Mega
 */
function extractSpecies(line: string): string | null {
  // Strip "@ item" first so parentheses analysis is cleaner.
  const left = line.split("@")[0]?.trim() ?? "";
  if (!left) return null;

  // Collect all (…) annotations on the left side.
  const annotations: string[] = [];
  let cleaned = left;
  const annotationRegex = /\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = annotationRegex.exec(left)) !== null) {
    annotations.push(match[1].trim());
  }
  cleaned = cleaned.replace(annotationRegex, "").trim();

  // If any annotation looks like a real species (more than 2 chars and
  // not just "M" or "F"), treat it as the true species.
  for (const a of annotations) {
    if (a.length > 2 && !/^[MF]$/.test(a)) {
      return a;
    }
  }

  // Otherwise, the left side itself is the species.
  return cleaned || null;
}

/**
 * Resolve a pokepaste URL (pokepast.es/{hash}) to its raw text.
 * Returns null if the fetch fails.
 */
export async function fetchPokepasteRaw(
  url: string,
  timeoutMs = 4000,
): Promise<string | null> {
  const rawUrl = normalizePokepasteRawUrl(url);
  if (!rawUrl) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(rawUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function normalizePokepasteRawUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("pokepast.es")) return null;
    // /raw suffix gives us plaintext; /<hash>/json gives JSON.
    if (u.pathname.endsWith("/raw")) return u.toString();
    return `${u.origin}${u.pathname.replace(/\/$/, "")}/raw`;
  } catch {
    return null;
  }
}

/** Extract pokepast.es URLs from a freeform body of text. */
export function extractPokepasteUrls(text: string): string[] {
  const out = new Set<string>();
  const regex = /https?:\/\/(?:www\.)?pokepast\.es\/[A-Za-z0-9_-]+/gi;
  const matches = text.match(regex);
  if (matches) {
    for (const m of matches) out.add(m);
  }
  return [...out];
}
