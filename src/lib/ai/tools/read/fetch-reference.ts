import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// Curated authoritative references — fetched on demand for agent research
const TRUSTED_REFERENCES: Record<string, string> = {
  champions_pokemon_list:
    "https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_in_Pok%C3%A9mon_Champions",
  champions_serebii: "https://www.serebii.net/pokemonchampions/pokemon.shtml",
  champions_items: "https://www.serebii.net/pokemonchampions/items.shtml",
  champions_megas_serebii:
    "https://www.serebii.net/pokemonchampions/megaabilities.shtml",
  champions_reg_ma_bulbapedia:
    "https://bulbapedia.bulbagarden.net/wiki/Regulation_Set_M-A",
  champions_reg_ma_serebii:
    "https://www.serebii.net/pokemonchampions/rankedbattle/regulationm-a.shtml",
  victory_road_champions: "https://victoryroad.pro/champions-regulations/",
  pikalytics_champions_usage:
    "https://www.pikalytics.com/ai/pokedex/championspreview",
};

/**
 * Strip HTML tags and excess whitespace from a page body.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export const fetchReferenceTool = new DynamicStructuredTool({
  name: "fetch_reference",
  description:
    "Fetch an authoritative reference page (Bulbapedia, Serebii, Victory Road, Pikalytics) to research Champions game data, available Pokemon, items, or rules. Returns extracted text content. Use this when you need to verify facts about Champions that aren't in your knowledge base.",
  schema: z.object({
    reference: z
      .enum([
        "champions_pokemon_list",
        "champions_serebii",
        "champions_items",
        "champions_megas_serebii",
        "champions_reg_ma_bulbapedia",
        "champions_reg_ma_serebii",
        "victory_road_champions",
        "pikalytics_champions_usage",
      ])
      .describe(
        "Which reference to fetch. champions_pokemon_list is the most comprehensive Pokemon availability list.",
      ),
    searchTerm: z
      .string()
      .optional()
      .describe(
        "Optional: extract only the section matching this search term (e.g., 'Basculegion', 'Mega Stone')",
      ),
  }),
  func: async ({ reference, searchTerm }) => {
    const url = TRUSTED_REFERENCES[reference];
    if (!url) {
      return JSON.stringify({ error: `Unknown reference: ${reference}` });
    }

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "MetaGross/1.0 (VGC analysis tool)" },
      });
      if (!response.ok) {
        return JSON.stringify({
          error: `Failed to fetch ${reference}: HTTP ${response.status}`,
          url,
        });
      }

      const html = await response.text();
      const text = htmlToText(html);

      // If searchTerm provided, extract just the relevant section
      if (searchTerm) {
        const lower = text.toLowerCase();
        const idx = lower.indexOf(searchTerm.toLowerCase());
        if (idx >= 0) {
          const start = Math.max(0, idx - 200);
          const end = Math.min(text.length, idx + 1500);
          return JSON.stringify({
            reference,
            url,
            searchTerm,
            excerpt: text.slice(start, end),
          });
        }
        return JSON.stringify({
          reference,
          url,
          searchTerm,
          notFound: true,
          note: `"${searchTerm}" not found in ${reference}. Try another reference.`,
        });
      }

      // Return first 3000 chars (truncated) to avoid token explosion
      return JSON.stringify({
        reference,
        url,
        excerpt: text.slice(0, 3000),
        truncated: text.length > 3000,
        note: "Provide a searchTerm to extract a specific section instead of this truncated preview.",
      });
    } catch (err) {
      return JSON.stringify({
        error: `Network error fetching ${reference}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  },
});
