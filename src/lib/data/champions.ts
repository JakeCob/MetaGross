/**
 * Pokemon Champions Regulation M-A game data.
 *
 * Sources:
 * - Pikalytics (competitive usage): pikalytics.com/ai/pokedex/championspreview
 * - Serebii: serebii.net/pokemonchampions/
 * - Bulbapedia: bulbapedia.bulbagarden.net/wiki/Regulation_Set_M-A
 * - Victory Road: victoryroad.pro/champions-regulations/
 * - Game8: game8.co/games/Pokemon-Champions
 *
 * Last updated: 2026-04-11
 */

// ---------------------------------------------------------------------------
// Format Rules
// ---------------------------------------------------------------------------
export const CHAMPIONS_RULES = {
  format: "Doubles (VGC)",
  teamSize: 6,
  bring: 4,
  level: 50,
  megaEvolution: true,
  terastallization: false,
  speciesClause: true,
  itemClause: true,
  legendaries: false,
  restricted: false,
  period: "April 8 - June 17, 2026",
  ivsFixed: true, // IVs are always 31 in Champions
  ivValue: 31,
};

// ---------------------------------------------------------------------------
// Point System (replaces EVs)
// ---------------------------------------------------------------------------
export const CHAMPIONS_POINTS = {
  totalMax: 66,
  perStatMax: 32,
  label: "Points",
  evConversion: 8, // 1 Stat Point = 8 EVs for damage calc
  vpCostPerPoint: 5, // 5 VP to set 1 stat point
};

// ---------------------------------------------------------------------------
// Pokemon — confirmed available from multiple sources
// ---------------------------------------------------------------------------

/**
 * Pokemon confirmed in Champions Reg M-A.
 * Source of truth: Bulbapedia — List of Pokémon in Pokémon Champions
 * (https://bulbapedia.bulbagarden.net/wiki/List_of_Pokémon_in_Pokémon_Champions)
 * Last synced: 2026-04-13.
 */
export const CHAMPIONS_POKEMON: string[] = [
  // Gen 1
  "Venusaur", "Charizard", "Blastoise", "Beedrill", "Pidgeot", "Arbok",
  "Pikachu", "Raichu", "Raichu-Alola", "Clefable",
  "Ninetales", "Ninetales-Alola", "Arcanine", "Arcanine-Hisui",
  "Alakazam", "Machamp", "Victreebel", "Slowbro", "Slowbro-Galar",
  "Gengar", "Kangaskhan", "Starmie", "Pinsir",
  "Tauros", "Tauros-Paldea-Combat", "Tauros-Paldea-Blaze", "Tauros-Paldea-Aqua",
  "Gyarados", "Ditto", "Vaporeon", "Jolteon", "Flareon",
  "Aerodactyl", "Snorlax", "Dragonite",
  // Gen 2
  "Meganium", "Typhlosion", "Typhlosion-Hisui", "Feraligatr",
  "Ariados", "Ampharos", "Azumarill", "Politoed", "Espeon", "Umbreon",
  "Slowking", "Slowking-Galar", "Forretress", "Steelix", "Scizor",
  "Heracross", "Skarmory", "Houndoom", "Tyranitar",
  // Gen 3
  "Pelipper", "Gardevoir", "Sableye", "Aggron", "Medicham",
  "Manectric", "Sharpedo", "Camerupt", "Torkoal", "Altaria",
  "Milotic", "Castform", "Banette", "Chimecho", "Absol", "Glalie",
  // Gen 4
  "Torterra", "Infernape", "Empoleon", "Luxray", "Roserade",
  "Rampardos", "Bastiodon", "Lopunny", "Spiritomb", "Garchomp",
  "Lucario", "Hippowdon", "Toxicroak", "Abomasnow", "Weavile",
  "Rhyperior", "Leafeon", "Glaceon", "Gliscor", "Mamoswine",
  "Gallade", "Froslass",
  "Rotom", "Rotom-Heat", "Rotom-Wash", "Rotom-Frost", "Rotom-Fan", "Rotom-Mow",
  // Gen 5
  "Serperior", "Emboar", "Samurott", "Samurott-Hisui",
  "Watchog", "Liepard", "Simisage", "Simisear", "Simipour",
  "Excadrill", "Audino", "Conkeldurr", "Whimsicott", "Krookodile",
  "Cofagrigus", "Garbodor", "Zoroark", "Zoroark-Hisui",
  "Reuniclus", "Vanilluxe", "Emolga", "Chandelure", "Beartic",
  "Stunfisk", "Stunfisk-Galar", "Golurk", "Hydreigon", "Volcarona",
  // Gen 6
  "Chesnaught", "Delphox", "Greninja", "Diggersby", "Talonflame",
  "Vivillon", "Floette-Eternal", "Florges", "Pangoro", "Furfrou",
  "Meowstic", "Meowstic-F", "Aegislash", "Aromatisse", "Slurpuff",
  "Clawitzer", "Heliolisk", "Tyrantrum", "Aurorus", "Sylveon",
  "Hawlucha", "Dedenne", "Goodra", "Goodra-Hisui", "Klefki",
  "Trevenant",
  "Gourgeist", "Gourgeist-Small", "Gourgeist-Large", "Gourgeist-Super",
  "Avalugg", "Avalugg-Hisui", "Noivern",
  // Gen 7
  "Decidueye", "Decidueye-Hisui", "Incineroar", "Primarina",
  "Toucannon", "Crabominable",
  "Lycanroc", "Lycanroc-Midnight", "Lycanroc-Dusk",
  "Toxapex", "Mudsdale", "Araquanid", "Salazzle", "Tsareena",
  "Oranguru", "Passimian", "Mimikyu", "Drampa", "Kommo-o",
  // Gen 8
  "Corviknight", "Flapple", "Appletun", "Sandaconda", "Polteageist",
  "Hatterene", "Mr. Rime", "Runerigus", "Alcremie", "Morpeko",
  "Dragapult",
  // Hisuian / Legends Arceus additions
  "Wyrdeer", "Kleavor",
  "Basculegion", "Basculegion-F", "Sneasler",
  // Gen 9 (Paldea — non-Paradox, non-restricted only)
  "Meowscarada", "Skeledirge", "Quaquaval",
  "Maushold", "Maushold-Four",
  "Garganacl", "Armarouge", "Ceruledge", "Bellibolt", "Scovillain",
  "Espathra", "Tinkaton", "Palafin", "Palafin-Hero", "Orthworm",
  "Glimmora", "Farigiraf", "Kingambit",
  "Sinistcha", "Sinistcha-Masterpiece",
  "Archaludon", "Hydrapple",
];

// NOTE: The list above contains source-verified entries from Pikalytics
// (championspreview), Serebii (pokemonchampions), Bulbapedia, and
// Victory Road. It intentionally under-includes rather than
// over-includes — listing a Pokemon that is NOT in Champions leads to
// bad agent recommendations, which is worse than omitting a few.
//
// Unknown Pokemon are handled by the agent's fact-check flow
// (fetch_reference + search_web in get_pokemon_competitive_sets) before
// being suggested.

/**
 * Pokemon NOT in Champions (commonly suggested by AI incorrectly)
 */
export const NOT_IN_CHAMPIONS: string[] = [
  "Kingdra", "Ludicolo", "Amoonguss", "Rillaboom", "Flutter Mane",
  "Iron Hands", "Urshifu", "Urshifu-Rapid-Strike", "Calyrex-Ice",
  "Calyrex-Shadow", "Zacian", "Zamazenta", "Eternatus",
  "Koraidon", "Miraidon", "Ogerpon", "Raging Bolt", "Iron Crown",
  "Landorus", "Thundurus", "Tornadus", "Chien-Pao",
  // Confirmed cut from Champions Reg M-A (verified against Bulbapedia
  // roster 2026-04-13) — do NOT recommend these:
  "Metagross", "Salamence", "Dondozo", "Tatsugiri", "Grimmsnarl",
  // All Paradox Pokemon
  "Great Tusk", "Scream Tail", "Brute Bonnet", "Sandy Shocks",
  "Iron Treads", "Iron Bundle", "Iron Moth", "Iron Thorns",
  "Roaring Moon", "Iron Valiant", "Walking Wake", "Iron Leaves",
  "Gouging Fire", "Raging Bolt", "Iron Boulder", "Iron Crown",
  // Common excluded middle-stage evolutions. Current Bulbapedia roster still
  // has explicit exceptions such as Pikachu and Eternal Flower Floette.
  "Chansey", "Porygon2", "Electabuzz", "Magmar", "Rhydon",
  "Scyther", "Piloswine", "Dusclops", "Gurdurr", "Boldore",
  "Sneasel", "Sneasel-Hisui", "Duosion", "Klang", "Pawmo",
  "Dartrix", "Torracat", "Brionne", "Dewott", "Servine",
  "Quilladin", "Frogadier", "Braixen", "Dartrix", "Zweilous",
  "Fraxure", "Shelgon", "Metang", "Haunter", "Graveler",
  "Kadabra", "Machoke", "Electabuzz", "Magmar",
  // Baby forms — never in competitive
  "Pichu", "Cleffa", "Igglybuff", "Togepi", "Togetic",
  "Magby", "Elekid", "Smoochum", "Tyrogue", "Wynaut",
  "Azurill", "Budew", "Chingling", "Bonsly", "Mime Jr.",
  "Happiny", "Munchlax", "Mantyke", "Riolu",
];

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/**
 * Items confirmed in Champions from competitive usage (Pikalytics).
 * NOTE: Some items (Life Orb, Choice Specs) appear in Showdown Champions Preview
 * but may be unavailable on cartridge. Flagged as "unverified_cartridge".
 */
export const CHAMPIONS_ITEMS_CONFIRMED: string[] = [
  // Berries
  "Sitrus Berry", "Lum Berry", "Figy Berry", "Aguav Berry",
  "Shuca Berry", "Chople Berry", "Occa Berry", "Colbur Berry",
  // Competitive staples
  "Focus Sash", "Choice Scarf", "Leftovers", "Rocky Helmet",
  "Safety Goggles", "Clear Amulet", "Covert Cloak", "Mental Herb",
  "White Herb", "Mirror Herb", "Weakness Policy", "Eject Button",
  "Throat Spray", "Psychic Seed", "Room Service",
  "Normal Gem", "Power Herb", "Wide Lens", "Razor Fang",
  "Toxic Orb", "Air Balloon", "Muscle Band", "Adrenaline Orb",
  "Black Glasses", "Black Sludge",
  // Mega Stones
  "Charizardite X", "Charizardite Y", "Venusaurite", "Blastoisinite",
  "Garchompite", "Gengarite", "Tyranitarite", "Kangaskhanite",
  "Gyaradosite", "Scizorite", "Heracronite", "Houndoominite",
  "Aerodactylite", "Alakazite", "Ampharosite", "Absolite",
  "Altarianite", "Banettite", "Beedrillite", "Cameruptite",
  "Lopunnite", "Lucarionite", "Mawilite", "Medichamite",
  "Pidgeotite", "Pinsirite", "Sablenite", "Sharpedonite",
  "Slowbronite", "Steelixite", "Audinite",
  // New Champions Mega Stones
  "Meganiumite", "Typhlosionite", "Feraligatrite",
  "Dragoninite", "Excadrillinite", "Delphoxite",
  "Greninjaite", "Hawluchite", "Froslasite",
];

/**
 * Items that may NOT be in Champions (reportedly cut, but appear in Showdown preview).
 * Use these with caution — Pikalytics Showdown data may include them.
 */
export const CHAMPIONS_ITEMS_UNCERTAIN: string[] = [
  "Life Orb", "Choice Band", "Choice Specs", "Assault Vest",
  "Eject Pack", "Loaded Dice", "Damp Rock",
];

// ---------------------------------------------------------------------------
// Mega Evolutions
// ---------------------------------------------------------------------------

/**
 * Available Mega Evolutions in Champions.
 * NOTE: Some base Pokemon exist but their Mega Stone is NOT available.
 */
export const CHAMPIONS_MEGAS: Record<string, { stone: string; confirmed: boolean }> = {
  // Returning Megas (Gen 6/7)
  "Venusaur": { stone: "Venusaurite", confirmed: true },
  "Charizard-Mega-X": { stone: "Charizardite X", confirmed: true },
  "Charizard-Mega-Y": { stone: "Charizardite Y", confirmed: true },
  "Blastoise": { stone: "Blastoisinite", confirmed: true },
  "Beedrill": { stone: "Beedrillite", confirmed: true },
  "Pidgeot": { stone: "Pidgeotite", confirmed: true },
  "Alakazam": { stone: "Alakazite", confirmed: true },
  "Slowbro": { stone: "Slowbronite", confirmed: true },
  "Gengar": { stone: "Gengarite", confirmed: true },
  "Kangaskhan": { stone: "Kangaskhanite", confirmed: true },
  "Pinsir": { stone: "Pinsirite", confirmed: true },
  "Gyarados": { stone: "Gyaradosite", confirmed: true },
  "Aerodactyl": { stone: "Aerodactylite", confirmed: true },
  "Steelix": { stone: "Steelixite", confirmed: true },
  "Scizor": { stone: "Scizorite", confirmed: true },
  "Heracross": { stone: "Heracronite", confirmed: true },
  "Houndoom": { stone: "Houndoominite", confirmed: true },
  "Tyranitar": { stone: "Tyranitarite", confirmed: true },
  "Gardevoir": { stone: "Gardevoirite", confirmed: true },
  "Sableye": { stone: "Sablenite", confirmed: true },
  "Altaria": { stone: "Altarianite", confirmed: true },
  "Absol": { stone: "Absolite", confirmed: true },
  "Garchomp": { stone: "Garchompite", confirmed: true },
  "Lucario": { stone: "Lucarionite", confirmed: true },
  "Lopunny": { stone: "Lopunnite", confirmed: true },
  "Audino": { stone: "Audinite", confirmed: true },
  "Ampharos": { stone: "Ampharosite", confirmed: true },
  // New Champions Megas (Legends Z-A)
  "Meganium": { stone: "Meganiumite", confirmed: true },
  "Typhlosion": { stone: "Typhlosionite", confirmed: true },
  "Feraligatr": { stone: "Feraligatrite", confirmed: true },
  "Dragonite": { stone: "Dragoninite", confirmed: true },
  "Excadrill": { stone: "Excadrillinite", confirmed: true },
  "Froslass": { stone: "Froslasite", confirmed: true },
  "Delphox": { stone: "Delphoxite", confirmed: true },
  "Greninja": { stone: "Greninjaite", confirmed: true },
  "Hawlucha": { stone: "Hawluchite", confirmed: true },
};

/**
 * Pokemon that exist in Champions but CANNOT Mega Evolve
 * (their Mega Stone is not in the game).
 *
 * NOTE: Metagross and Salamence are NOT in Champions at all — see
 * NOT_IN_CHAMPIONS above.
 */
export const NO_MEGA_DESPITE_BASE: string[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isChampionsPokemon(species: string): boolean {
  return CHAMPIONS_POKEMON.some(
    (p) => p.toLowerCase() === species.toLowerCase(),
  );
}

export function isChampionsItem(item: string): boolean {
  return (
    CHAMPIONS_ITEMS_CONFIRMED.some(
      (i) => i.toLowerCase() === item.toLowerCase(),
    ) ||
    CHAMPIONS_ITEMS_UNCERTAIN.some(
      (i) => i.toLowerCase() === item.toLowerCase(),
    )
  );
}

export function isConfirmedNotInChampions(species: string): boolean {
  return NOT_IN_CHAMPIONS.some(
    (p) => p.toLowerCase() === species.toLowerCase(),
  );
}

export function canMegaEvolve(species: string): boolean {
  return Object.keys(CHAMPIONS_MEGAS).some(
    (k) => k === species || k.startsWith(`${species}-Mega`),
  );
}

/**
 * Look up the Mega Stone → base species / mega species mapping.
 * Returns the mega form name when the held item triggers Mega Evolution
 * for the given base species in Champions; otherwise null.
 *
 * Examples:
 *   getMegaFormFor("Garchomp", "Garchompite") → "Garchomp-Mega"
 *   getMegaFormFor("Charizard", "Charizardite X") → "Charizard-Mega-X"
 *   getMegaFormFor("Dragonite", "Dragoninite") → "Dragonite-Mega"
 *   getMegaFormFor("Pikachu", "Focus Sash") → null
 */
export function getMegaFormFor(
  species: string,
  item: string | undefined | null,
): string | null {
  if (!species || !item) return null;
  const itemLc = item.trim().toLowerCase();
  for (const [megaKey, info] of Object.entries(CHAMPIONS_MEGAS)) {
    if (info.stone.toLowerCase() !== itemLc) continue;
    const expectedBase = megaKey.split("-Mega")[0];
    if (expectedBase.toLowerCase() === species.toLowerCase()) {
      return megaKey;
    }
  }
  return null;
}
