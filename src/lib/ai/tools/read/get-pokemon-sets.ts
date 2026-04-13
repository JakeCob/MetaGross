import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  isConfirmedNotInChampions,
  isChampionsPokemon,
} from "@/lib/data/champions";

const PIKALYTICS_BASE = "https://www.pikalytics.com/ai/pokedex";
const DEFAULT_FORMAT = "championspreview";

// Suggested replacements for commonly-requested but unavailable Pokemon
const REPLACEMENT_SUGGESTIONS: Record<string, string[]> = {
  Ludicolo: ["Basculegion", "Pelipper (Water+Flying)", "Gastrodon (Ground/Water)"],
  Kingdra: ["Basculegion", "Gyarados", "Milotic"],
  Ferrothorn: ["Archaludon (Steel/Dragon)", "Kingambit (Dark/Steel)"],
  Amoonguss: ["Sinistcha (Grass/Ghost with Rage Powder)", "Meganium"],
  Rillaboom: ["Meowscarada", "Venusaur"],
  "Flutter Mane": ["Gengar (Ghost/Poison)", "Sinistcha"],
  "Iron Hands": ["Kommo-o", "Hitmontop"],
  Urshifu: ["Sneasler", "Kingambit"],
  "Urshifu-Rapid-Strike": ["Sneasler", "Basculegion"],
  "Calyrex-Ice": ["Kangaskhan (Mega)"],
  "Calyrex-Shadow": ["Dragapult", "Gengar"],
  "Raging Bolt": ["Archaludon", "Dragonite"],
  "Iron Crown": ["Metagross", "Archaludon"],
  "Ogerpon": ["Venusaur", "Meowscarada"],
  Miraidon: ["Raichu", "Archaludon"],
  Koraidon: ["Salamence", "Garchomp"],
  Tornadus: ["Dragonite", "Pelipper"],
  Landorus: ["Garchomp", "Excadrill"],
  "Chien-Pao": ["Sneasler", "Kingambit"],
  Zacian: ["Kingambit", "Metagross"],
  Zamazenta: ["Archaludon", "Corviknight"],
};

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

// Weather-synergy ability mapping
const WEATHER_ABILITIES: Record<string, string[]> = {
  rain: ["Swift Swim", "Rain Dish", "Hydration", "Dry Skin"],
  sun: ["Chlorophyll", "Solar Power", "Flower Gift", "Leaf Guard"],
  sand: ["Sand Rush", "Sand Force", "Sand Veil"],
  snow: ["Slush Rush", "Ice Body", "Snow Cloak"],
};

function annotateAbilities(
  abilities: { name: string; usage: number }[],
  teamArchetype?: string,
): { name: string; usage: number; synergy?: string }[] {
  if (!teamArchetype) return abilities;
  const archetype = teamArchetype.toLowerCase();

  return abilities.map((ab) => {
    for (const [weather, synergyAbilities] of Object.entries(WEATHER_ABILITIES)) {
      if (archetype.includes(weather) && synergyAbilities.includes(ab.name)) {
        return {
          ...ab,
          synergy: `⭐ BEST CHOICE for ${weather} teams — synergizes with weather`,
        };
      }
    }
    if (archetype.includes("trick room") && ab.name === "Unburden") {
      return { ...ab, synergy: "⚠️ AVOID on Trick Room teams — boosts speed which is bad for TR" };
    }
    return ab;
  });
}

export const getPokemonSetsTool = new DynamicStructuredTool({
  name: "get_pokemon_competitive_sets",
  description:
    "Get ACTUAL competitive sets for a Pokemon from Pikalytics usage data (Champions Reg M-A). Returns real moves, abilities, items, and teammates with usage percentages. PASS teamArchetype to get synergy hints for ability selection. ALWAYS use this before recommending any moves, abilities, or items — never guess from memory.",
  schema: z.object({
    species: z
      .string()
      .describe(
        "Pokemon species name (e.g. 'Incineroar', 'Archaludon', 'Rotom-Wash')",
      ),
    teamArchetype: z
      .string()
      .optional()
      .describe(
        "Team archetype for synergy analysis: 'rain', 'sun', 'sand', 'snow', 'trick room', 'hyper offense', 'balance'. When provided, abilities will be annotated with synergy hints (e.g., Swift Swim for rain teams).",
      ),
  }),
  func: async ({ species, teamArchetype }) => {
    // Early rejection: don't waste a network call on Pokemon confirmed NOT in Champions
    if (isConfirmedNotInChampions(species)) {
      const replacements = REPLACEMENT_SUGGESTIONS[species] || [];
      return JSON.stringify({
        error: `❌ ${species} is NOT in Pokemon Champions Reg M-A. Do NOT include it in the team.`,
        species,
        suggestedReplacements: replacements.length > 0
          ? replacements
          : ["Pick from the top meta: Incineroar, Archaludon, Sneasler, Sinistcha, Pelipper, Dragonite, Whimsicott, Garchomp, Kingambit, Metagross"],
        action: "Choose a different Pokemon from the Champions pool. Do not ask about this Pokemon again.",
      });
    }

    // Soft warning: Pokemon not on the known-confirmed Champions list.
    // The agent MUST fact-check before using it.
    if (!isChampionsPokemon(species)) {
      return JSON.stringify({
        warning: `⚠ ${species} is NOT on MetaGross's confirmed Champions roster. This does not mean it's banned — the local list is incomplete. But DO NOT include ${species} in a team until you have verified availability.`,
        species,
        requiredAction:
          `BEFORE suggesting ${species}, call fetch_reference with reference='bulbapedia_champions_list' AND search the returned text for '${species}'. If not found, also call search_web with '${species} Pokemon Champions Regulation M-A available' and verify from at least TWO sources (Bulbapedia, Serebii, Victory Road, Pikalytics). Only proceed if confirmed. If not confirmed, reject and pick a known-legal alternative.`,
        knownLegalAlternatives: [
          "Incineroar", "Archaludon", "Sneasler", "Sinistcha", "Pelipper",
          "Dragonite", "Whimsicott", "Garchomp", "Kingambit", "Metagross",
          "Charizard", "Tyranitar", "Gengar", "Gardevoir", "Primarina",
        ],
      });
    }

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

      const annotatedAbilities = annotateAbilities(abilities, teamArchetype);
      const hasSynergy = annotatedAbilities.some((a) => a.synergy?.includes("BEST CHOICE"));

      return JSON.stringify({
        species,
        format: "Champions Reg M-A",
        dataDate,
        moves: moves.slice(0, 12),
        abilities: annotatedAbilities,
        items: items.slice(0, 10),
        teammates: teammates.slice(0, 10),
        note: hasSynergy
          ? "⭐ A synergy-best ability was found — USE IT even if it has lower usage %. Team synergy > raw usage."
          : "This is REAL competitive usage data. Pick the ability that fits the team strategy, then highest-usage.",
      });
    } catch (err) {
      return JSON.stringify({
        error: `Failed to fetch Pikalytics data for "${species}": ${err instanceof Error ? err.message : String(err)}. Use search_web as a fallback to find competitive sets.`,
        species,
      });
    }
  },
});
