import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const PIKALYTICS_BASE = "https://www.pikalytics.com/ai/pokedex";
const DEFAULT_FORMAT = "championspreview";

/**
 * Parse a section of `- **Name**: value%` lines from Pikalytics Markdown.
 * Returns array of { name, usage } sorted by usage descending.
 */
function parsePercentSection(
  md: string,
  sectionHeader: string,
): { name: string; usage: number }[] {
  const entries: { name: string; usage: number }[] = [];

  const headerIndex = md.indexOf(`## ${sectionHeader}`);
  if (headerIndex === -1) return entries;

  const afterHeader = md.slice(headerIndex + sectionHeader.length + 3);
  const nextSection = afterHeader.indexOf("\n## ");
  const sectionText =
    nextSection === -1 ? afterHeader : afterHeader.slice(0, nextSection);

  const lines = sectionText.split("\n");
  for (const line of lines) {
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

export const getPokemonSetsTool = new DynamicStructuredTool({
  name: "get_pokemon_competitive_sets",
  description:
    "Get ACTUAL competitive sets for a Pokemon from Pikalytics usage data (Champions Reg M-A). Returns real moves, abilities, items, and teammates with usage percentages. ALWAYS use this before recommending any moves, abilities, or items for a Pokemon — never guess from memory.",
  schema: z.object({
    species: z
      .string()
      .describe(
        "Pokemon species name (e.g. 'Incineroar', 'Archaludon', 'Rotom-Wash')",
      ),
  }),
  func: async ({ species }) => {
    try {
      const url = `${PIKALYTICS_BASE}/${encodeURIComponent(DEFAULT_FORMAT)}/${encodeURIComponent(species)}`;
      const response = await fetch(url, {
        headers: { "User-Agent": "MetaGross/1.0 (VGC analysis tool)" },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return JSON.stringify({
            error: `No Pikalytics data found for "${species}". The Pokemon may not be used in Champions or the name may be misspelled. Try search_web to verify.`,
            species,
          });
        }
        return JSON.stringify({
          error: `Pikalytics returned status ${response.status} for "${species}". Use search_web as a fallback to find competitive sets.`,
          species,
        });
      }

      const md = await response.text();

      const moves = parsePercentSection(md, "Common Moves");
      const abilities = parsePercentSection(md, "Common Abilities");
      const items = parsePercentSection(md, "Common Items");
      const teammates = parsePercentSection(md, "Common Teammates");

      // Parse data date
      const dateMatch = md.match(/\*\*Data Date\*\*\s*\|\s*(\S+)/);
      const dataDate = dateMatch?.[1] ?? "unknown";

      if (
        moves.length === 0 &&
        abilities.length === 0 &&
        items.length === 0
      ) {
        return JSON.stringify({
          error: `Pikalytics returned a page for "${species}" but no usable set data was parsed. Use search_web as a fallback.`,
          species,
          rawLength: md.length,
        });
      }

      return JSON.stringify({
        species,
        format: "Champions Reg M-A",
        dataDate,
        moves: moves.slice(0, 12),
        abilities,
        items: items.slice(0, 10),
        teammates: teammates.slice(0, 10),
        note: "This is REAL competitive usage data. Use the highest-usage options unless you have a specific reason not to.",
      });
    } catch (err) {
      return JSON.stringify({
        error: `Failed to fetch Pikalytics data for "${species}": ${err instanceof Error ? err.message : String(err)}. Use search_web as a fallback to find competitive sets.`,
        species,
      });
    }
  },
});
