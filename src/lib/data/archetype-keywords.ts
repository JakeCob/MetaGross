/**
 * Archetype and strategy keyword mappings for fuzzy Pokemon search.
 *
 * When a user types a concept word (e.g., "rain", "bulky", "fast"),
 * return the most relevant Champions Pokemon that fit that archetype.
 *
 * These are curated lists of top meta picks per role.
 */

export interface ArchetypeMatch {
  keywords: string[];
  pokemon: string[];
  description: string;
}

export const ARCHETYPE_KEYWORDS: ArchetypeMatch[] = [
  // Weather archetypes
  {
    keywords: ["rain", "rainy", "wet", "drizzle", "water team", "rain team"],
    pokemon: [
      "Pelipper",
      "Archaludon",
      "Basculegion",
      "Dragonite",
      "Politoed",
      "Gyarados",
      "Kingdra",
      "Primarina",
      "Milotic",
      "Palafin-Hero",
    ],
    description: "Rain team abusers + setters",
  },
  {
    keywords: ["sun", "sunny", "drought", "fire team", "sun team"],
    pokemon: [
      "Charizard",
      "Venusaur",
      "Torkoal",
      "Whimsicott",
      "Incineroar",
      "Meowscarada",
      "Delphox",
      "Volcarona",
      "Arcanine-Hisui",
    ],
    description: "Sun team setters + Chlorophyll abusers",
  },
  {
    keywords: ["sand", "sandstorm", "sandy", "desert"],
    pokemon: [
      "Tyranitar",
      "Excadrill",
      "Garchomp",
      "Hippowdon",
      "Kingambit",
      "Glimmora",
      "Sandaconda",
    ],
    description: "Sand Stream + Sand Rush",
  },
  {
    keywords: ["snow", "snowy", "hail", "ice team", "snow team"],
    pokemon: [
      "Ninetales-Alola",
      "Froslass",
      "Glaceon",
      "Baxcalibur",
      "Cetitan",
      "Corviknight",
      "Aurorus",
    ],
    description: "Snow Warning + Slush Rush + Aurora Veil",
  },
  // Strategy archetypes
  {
    keywords: ["trick room", "tr", "slow", "tr team", "trickroom"],
    pokemon: [
      "Farigiraf",
      "Sinistcha",
      "Hatterene",
      "Dondozo",
      "Ursaluna",
      "Incineroar",
      "Armarouge",
      "Tatsugiri",
    ],
    description: "Trick Room setters + slow attackers",
  },
  {
    keywords: ["hyper offense", "ho", "aggressive", "fast offense", "sweep"],
    pokemon: [
      "Dragapult",
      "Sneasler",
      "Metagross",
      "Kingambit",
      "Dragonite",
      "Garchomp",
      "Meowscarada",
      "Raichu",
    ],
    description: "Fast sweepers + priority moves",
  },
  {
    keywords: ["balance", "balanced", "goodstuffs", "staple"],
    pokemon: [
      "Incineroar",
      "Archaludon",
      "Sneasler",
      "Sinistcha",
      "Dragonite",
      "Garchomp",
      "Kingambit",
      "Whimsicott",
    ],
    description: "S-tier meta staples",
  },
  {
    keywords: ["perish trap", "perish song", "shadow tag"],
    pokemon: ["Gengar", "Politoed", "Whimsicott", "Sinistcha"],
    description: "Shadow Tag + Perish Song trap",
  },

  // Role archetypes
  {
    keywords: ["setter", "lead", "support setter"],
    pokemon: [
      "Pelipper",
      "Politoed",
      "Tyranitar",
      "Ninetales-Alola",
      "Torkoal",
      "Charizard",
    ],
    description: "Weather setters",
  },
  {
    keywords: ["pivot", "pivoting", "parting shot", "u-turn"],
    pokemon: [
      "Incineroar",
      "Corviknight",
      "Rotom-Wash",
      "Talonflame",
      "Pelipper",
      "Meowscarada",
    ],
    description: "Pivots with U-turn / Parting Shot / Volt Switch",
  },
  {
    keywords: ["intimidate"],
    pokemon: [
      "Incineroar",
      "Arcanine-Hisui",
      "Salamence",
      "Gyarados",
      "Landorus",
    ],
    description: "Intimidate ability",
  },
  {
    keywords: ["fake out"],
    pokemon: [
      "Incineroar",
      "Whimsicott",
      "Meowscarada",
      "Raichu",
      "Kangaskhan",
      "Maushold",
    ],
    description: "Fake Out users",
  },
  {
    keywords: ["redirect", "rage powder", "follow me"],
    pokemon: ["Sinistcha", "Togekiss", "Clefable"],
    description: "Rage Powder / Follow Me redirection",
  },
  {
    keywords: ["tailwind"],
    pokemon: ["Pelipper", "Whimsicott", "Talonflame", "Corviknight"],
    description: "Tailwind setters",
  },
  {
    keywords: ["priority", "priority move", "fake out", "sucker punch"],
    pokemon: [
      "Kingambit",
      "Incineroar",
      "Sneasler",
      "Dragonite",
      "Talonflame",
    ],
    description: "Priority move users",
  },
  {
    keywords: ["physical", "physical attacker", "atk"],
    pokemon: [
      "Sneasler",
      "Garchomp",
      "Kingambit",
      "Dragonite",
      "Basculegion",
      "Metagross",
      "Excadrill",
    ],
    description: "Physical attackers",
  },
  {
    keywords: ["special", "special attacker", "spa"],
    pokemon: [
      "Archaludon",
      "Dragapult",
      "Gardevoir",
      "Gengar",
      "Charizard",
      "Primarina",
      "Delphox",
    ],
    description: "Special attackers",
  },
  {
    keywords: ["fast", "speed", "speedy", "quick"],
    pokemon: [
      "Dragapult",
      "Sneasler",
      "Dragonite",
      "Talonflame",
      "Meowscarada",
      "Raichu",
      "Whimsicott",
    ],
    description: "Fast Pokemon (high Speed stat)",
  },
  {
    keywords: ["bulky", "tank", "bulk", "defensive", "wall"],
    pokemon: [
      "Corviknight",
      "Dondozo",
      "Clefable",
      "Milotic",
      "Farigiraf",
      "Incineroar",
    ],
    description: "Bulky walls / tanks",
  },
  {
    keywords: ["mega", "mega evolution"],
    pokemon: [
      "Charizard",
      "Dragonite",
      "Metagross",
      "Tyranitar",
      "Garchomp",
      "Venusaur",
      "Gyarados",
      "Gengar",
      "Kangaskhan",
      "Heracross",
      "Scizor",
    ],
    description: "Pokemon with Mega Evolution in Champions",
  },
  {
    keywords: ["steel killer", "anti steel"],
    pokemon: ["Sneasler", "Basculegion", "Garchomp"],
    description: "OHKOs Steel types (Archaludon, Kingambit)",
  },
  {
    keywords: ["sweeper", "wincon", "win condition"],
    pokemon: [
      "Archaludon",
      "Dragonite",
      "Sneasler",
      "Kingambit",
      "Dragapult",
      "Basculegion",
    ],
    description: "Primary win conditions / sweepers",
  },
];

/**
 * Match a query string against archetype keywords.
 * Returns the Pokemon names for matching archetypes.
 */
export function matchArchetype(query: string): {
  pokemon: string[];
  matchedKeywords: string[];
  descriptions: string[];
} {
  const lower = query.toLowerCase().trim();
  if (!lower) {
    return { pokemon: [], matchedKeywords: [], descriptions: [] };
  }

  const matched = new Set<string>();
  const keywords: string[] = [];
  const descriptions: string[] = [];

  for (const entry of ARCHETYPE_KEYWORDS) {
    const match = entry.keywords.find((k) =>
      lower === k || lower.includes(k) || k.includes(lower),
    );
    if (match) {
      keywords.push(match);
      descriptions.push(entry.description);
      for (const p of entry.pokemon) matched.add(p);
    }
  }

  return {
    pokemon: Array.from(matched),
    matchedKeywords: keywords,
    descriptions,
  };
}
