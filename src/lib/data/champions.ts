/**
 * Pokemon Champions regulation game data.
 *
 * This module is a MULTI-REGULATION registry. Each season's roster / items /
 * megas / rules live in a `Regulation` object inside `REGULATIONS`, and
 * `ACTIVE_REGULATION` points at the current season. The legacy top-level
 * exports (`CHAMPIONS_POKEMON`, `isChampionsPokemon`, …) resolve to the
 * ACTIVE regulation so existing callers keep working untouched; pass a
 * `format` string to any helper to target a specific regulation instead.
 *
 * Regulations:
 * - M-A (April 8 – June 17, 2026)
 * - M-B (June 17 – September 2, 2026) — additive to M-A; ACTIVE.
 *
 * Sources:
 * - Pikalytics (competitive usage): pikalytics.com/ai/pokedex/championspreview
 * - Serebii: serebii.net/pokemonchampions/
 * - Bulbapedia: bulbapedia.bulbagarden.net/wiki/Regulation_Set_M-A (+ /Mega_Stone)
 * - Victory Road: victoryroad.pro/champions-regulations/
 * - Game8: game8.co/games/Pokemon-Champions
 *
 * See docs/agent-knowledge/regulation-m-b.md for the M-B diff + sources.
 * Last updated: 2026-06-17.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type RegulationId = "m-a" | "m-b";

export interface RegulationRules {
  format: string;
  teamSize: number;
  bring: number;
  level: number;
  megaEvolution: boolean;
  terastallization: boolean;
  speciesClause: boolean;
  itemClause: boolean;
  legendaries: boolean;
  restricted: boolean;
  period: string;
  ivsFixed: boolean;
  ivValue: number;
}

export interface PointSystem {
  totalMax: number;
  perStatMax: number;
  label: string;
  evConversion: number;
  vpCostPerPoint: number;
}

export interface ChampionsMegaInfo {
  baseSpecies: string;
  stone: string;
  confirmed: boolean;
}

export interface Regulation {
  id: RegulationId;
  /** Human-facing label, e.g. "Champions Reg M-A". */
  label: string;
  /** Canonical format string stored on teams/matches, e.g. "champions-reg-m-a". */
  formatId: string;
  rules: RegulationRules;
  points: PointSystem;
  pokemon: string[];
  notInPokemon: string[];
  itemsConfirmed: string[];
  itemsUncertain: string[];
  itemsBanned: string[];
  megas: Record<string, ChampionsMegaInfo>;
  unavailableMoves: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Shared (regulation-independent) data
// ---------------------------------------------------------------------------

/** Point System — identical across M-A and M-B (replaces traditional EVs). */
const POINTS: PointSystem = {
  totalMax: 66,
  perStatMax: 32,
  label: "Points",
  evConversion: 8, // 1 Stat Point = 8 EVs for damage calc
  vpCostPerPoint: 5, // 5 VP to set 1 stat point
};

/**
 * Species → moves that are NOT legal for them in Champions, even though
 * @pkmn/dex thinks they're learnable. Unchanged between M-A and M-B.
 * Keep entries narrow and well-sourced — wrong entries block legal builds.
 */
const UNAVAILABLE_MOVES: Record<string, string[]> = {
  // Incineroar: Knock Off was cut — not in Incineroar's Champions movepool
  // (reported 2026-04-23). Fake Out, Flare Blitz, Parting Shot, Darkest
  // Lariat, Throat Chop are the common replacements.
  Incineroar: ["Knock Off"],
};

// ===========================================================================
// REGULATION M-A
// ===========================================================================

const M_A_RULES: RegulationRules = {
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

/**
 * Pokemon confirmed in Champions Reg M-A.
 * Source of truth: Bulbapedia — List of Pokémon in Pokémon Champions.
 * Last synced: 2026-04-13.
 */
const M_A_POKEMON: string[] = [
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

/** Pokemon NOT in Champions Reg M-A (commonly suggested by AI incorrectly). */
const M_A_NOT_IN: string[] = [
  "Kingdra", "Ludicolo", "Amoonguss", "Rillaboom", "Flutter Mane",
  "Iron Hands", "Urshifu", "Urshifu-Rapid-Strike", "Calyrex-Ice",
  "Calyrex-Shadow", "Zacian", "Zamazenta", "Eternatus",
  "Koraidon", "Miraidon", "Ogerpon", "Raging Bolt", "Iron Crown",
  "Landorus", "Thundurus", "Tornadus", "Chien-Pao",
  // Paldea-era legendaries/ghost-types that aren't in Champions
  "Gholdengo", "Gimmighoul", "Ting-Lu", "Wo-Chien", "Chi-Yu",
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

/**
 * Items confirmed in Champions Reg M-A — canonical list from Game8.
 * Many VGC staples (Weakness Policy, Life Orb, Choice Band, etc.) are NOT
 * in M-A. Anything not on this list is treated as disallowed for M-A.
 */
const M_A_ITEMS_CONFIRMED: string[] = [
  // Pinch Berries
  "Sitrus Berry", "Lum Berry", "Persim Berry", "Oran Berry",
  "Leppa Berry", "Aspear Berry", "Rawst Berry", "Pecha Berry",
  "Chesto Berry", "Cheri Berry",
  // Type-resist Berries
  "Roseli Berry", "Chilan Berry", "Babiri Berry", "Haban Berry",
  "Charti Berry", "Tanga Berry", "Payapa Berry", "Kebia Berry",
  "Chople Berry", "Rindo Berry", "Occa Berry", "Wacan Berry",
  "Colbur Berry", "Kasib Berry", "Coba Berry", "Shuca Berry",
  "Yache Berry", "Passho Berry",
  // Type-boost held items
  "Soft Sand", "Sharp Beak", "Silk Scarf", "Magnet",
  "Black Belt", "Black Glasses", "Silver Powder", "Miracle Seed",
  "Hard Stone", "Mystic Water", "Poison Barb", "Never-Melt Ice",
  "Twisted Spoon", "Charcoal", "Dragon Fang", "Fairy Feather",
  "Spell Tag", "Metal Coat",
  // Competitive staples actually in Champions
  "Focus Sash", "Choice Scarf", "Leftovers", "Shell Bell",
  "White Herb", "Mental Herb", "Focus Band", "Light Ball",
  "King's Rock", "Bright Powder", "Scope Lens", "Quick Claw",
  // Mega Stones (Gen 6 legacy)
  "Venusaurite", "Charizardite X", "Charizardite Y", "Blastoisinite",
  "Beedrillite", "Pidgeotite", "Alakazite", "Slowbronite",
  "Gengarite", "Kangaskhanite", "Pinsirite", "Gyaradosite",
  "Aerodactylite", "Ampharosite", "Scizorite", "Heracronite",
  "Houndoominite", "Tyranitarite", "Gardevoirite", "Sablenite",
  "Aggronite", "Medichamite", "Manectite", "Sharpedonite",
  "Cameruptite", "Altarianite", "Banettite", "Absolite",
  "Glalitite", "Lopunnite", "Garchompite", "Lucarionite",
  "Abomasite", "Galladite", "Audinite",
  // Mega Stones (Legends Z-A additions)
  "Clefablite", "Victreebelite", "Starminite",
  "Chimechite", "Skarmorite",
  "Meganiumite", "Feraligite",
  "Dragoninite", "Excadrite", "Emboarite", "Chandelurite",
  "Golurkite", "Froslassite",
  "Chesnaughtite", "Delphoxite", "Greninjite", "Floettite",
  "Meowsticite", "Hawluchanite",
  "Drampanite", "Crabominite", "Scovillainite", "Glimmoranite",
];

/**
 * Items reported in other M-A data sources but NOT on the Game8 list.
 * Treat as not-in-format unless a newer source confirms them.
 */
const M_A_ITEMS_UNCERTAIN: string[] = [
  // Raichu Mega stones — Raichu is in roster but Game8 doesn't list these
  // stones for M-A. (Confirmed in M-B.)
  "Raichunite X", "Raichunite Y",
];

/** Items that VGC players expect but are confirmed NOT in Champions Reg M-A. */
const M_A_ITEMS_BANNED: string[] = [
  "Weakness Policy", "Life Orb", "Choice Band", "Choice Specs",
  "Assault Vest", "Rocky Helmet", "Safety Goggles", "Clear Amulet",
  "Covert Cloak", "Eject Button", "Eject Pack", "Throat Spray",
  "Power Herb", "Wide Lens", "Razor Fang", "Toxic Orb",
  "Flame Orb", "Air Balloon", "Muscle Band", "Adrenaline Orb",
  "Black Sludge", "Mirror Herb", "Psychic Seed", "Grassy Seed",
  "Electric Seed", "Misty Seed", "Room Service", "Loaded Dice",
  "Damp Rock", "Heat Rock", "Smooth Rock", "Icy Rock",
  "Light Clay", "Figy Berry", "Aguav Berry", "Iapapa Berry",
  "Mago Berry", "Wiki Berry", "Normal Gem",
];

/**
 * Available Mega Evolutions in Champions Reg M-A.
 * Keys use the canonical @pkmn/dex Mega species names.
 */
const M_A_MEGAS: Record<string, ChampionsMegaInfo> = {
  "Venusaur-Mega": { baseSpecies: "Venusaur", stone: "Venusaurite", confirmed: true },
  "Charizard-Mega-X": { baseSpecies: "Charizard", stone: "Charizardite X", confirmed: true },
  "Charizard-Mega-Y": { baseSpecies: "Charizard", stone: "Charizardite Y", confirmed: true },
  "Blastoise-Mega": { baseSpecies: "Blastoise", stone: "Blastoisinite", confirmed: true },
  "Beedrill-Mega": { baseSpecies: "Beedrill", stone: "Beedrillite", confirmed: true },
  "Pidgeot-Mega": { baseSpecies: "Pidgeot", stone: "Pidgeotite", confirmed: true },
  "Clefable-Mega": { baseSpecies: "Clefable", stone: "Clefablite", confirmed: true },
  "Alakazam-Mega": { baseSpecies: "Alakazam", stone: "Alakazite", confirmed: true },
  "Victreebel-Mega": { baseSpecies: "Victreebel", stone: "Victreebelite", confirmed: true },
  "Slowbro-Mega": { baseSpecies: "Slowbro", stone: "Slowbronite", confirmed: true },
  "Gengar-Mega": { baseSpecies: "Gengar", stone: "Gengarite", confirmed: true },
  "Kangaskhan-Mega": { baseSpecies: "Kangaskhan", stone: "Kangaskhanite", confirmed: true },
  "Starmie-Mega": { baseSpecies: "Starmie", stone: "Starminite", confirmed: true },
  "Raichu-Mega-X": { baseSpecies: "Raichu", stone: "Raichunite X", confirmed: true },
  "Raichu-Mega-Y": { baseSpecies: "Raichu", stone: "Raichunite Y", confirmed: true },
  "Pinsir-Mega": { baseSpecies: "Pinsir", stone: "Pinsirite", confirmed: true },
  "Gyarados-Mega": { baseSpecies: "Gyarados", stone: "Gyaradosite", confirmed: true },
  "Aerodactyl-Mega": { baseSpecies: "Aerodactyl", stone: "Aerodactylite", confirmed: true },
  "Dragonite-Mega": { baseSpecies: "Dragonite", stone: "Dragoninite", confirmed: true },
  "Meganium-Mega": { baseSpecies: "Meganium", stone: "Meganiumite", confirmed: true },
  "Feraligatr-Mega": { baseSpecies: "Feraligatr", stone: "Feraligite", confirmed: true },
  "Ampharos-Mega": { baseSpecies: "Ampharos", stone: "Ampharosite", confirmed: true },
  "Steelix-Mega": { baseSpecies: "Steelix", stone: "Steelixite", confirmed: true },
  "Scizor-Mega": { baseSpecies: "Scizor", stone: "Scizorite", confirmed: true },
  "Heracross-Mega": { baseSpecies: "Heracross", stone: "Heracronite", confirmed: true },
  "Skarmory-Mega": { baseSpecies: "Skarmory", stone: "Skarmorite", confirmed: true },
  "Houndoom-Mega": { baseSpecies: "Houndoom", stone: "Houndoominite", confirmed: true },
  "Tyranitar-Mega": { baseSpecies: "Tyranitar", stone: "Tyranitarite", confirmed: true },
  "Gardevoir-Mega": { baseSpecies: "Gardevoir", stone: "Gardevoirite", confirmed: true },
  "Sableye-Mega": { baseSpecies: "Sableye", stone: "Sablenite", confirmed: true },
  "Aggron-Mega": { baseSpecies: "Aggron", stone: "Aggronite", confirmed: true },
  "Medicham-Mega": { baseSpecies: "Medicham", stone: "Medichamite", confirmed: true },
  "Manectric-Mega": { baseSpecies: "Manectric", stone: "Manectite", confirmed: true },
  "Sharpedo-Mega": { baseSpecies: "Sharpedo", stone: "Sharpedonite", confirmed: true },
  "Camerupt-Mega": { baseSpecies: "Camerupt", stone: "Cameruptite", confirmed: true },
  "Altaria-Mega": { baseSpecies: "Altaria", stone: "Altarianite", confirmed: true },
  "Banette-Mega": { baseSpecies: "Banette", stone: "Banettite", confirmed: true },
  "Chimecho-Mega": { baseSpecies: "Chimecho", stone: "Chimechite", confirmed: true },
  "Absol-Mega": { baseSpecies: "Absol", stone: "Absolite", confirmed: true },
  "Glalie-Mega": { baseSpecies: "Glalie", stone: "Glalitite", confirmed: true },
  "Lopunny-Mega": { baseSpecies: "Lopunny", stone: "Lopunnite", confirmed: true },
  "Garchomp-Mega": { baseSpecies: "Garchomp", stone: "Garchompite", confirmed: true },
  "Lucario-Mega": { baseSpecies: "Lucario", stone: "Lucarionite", confirmed: true },
  "Abomasnow-Mega": { baseSpecies: "Abomasnow", stone: "Abomasite", confirmed: true },
  "Gallade-Mega": { baseSpecies: "Gallade", stone: "Galladite", confirmed: true },
  "Froslass-Mega": { baseSpecies: "Froslass", stone: "Froslassite", confirmed: true },
  "Emboar-Mega": { baseSpecies: "Emboar", stone: "Emboarite", confirmed: true },
  "Excadrill-Mega": { baseSpecies: "Excadrill", stone: "Excadrite", confirmed: true },
  "Audino-Mega": { baseSpecies: "Audino", stone: "Audinite", confirmed: true },
  "Chandelure-Mega": { baseSpecies: "Chandelure", stone: "Chandelurite", confirmed: true },
  "Golurk-Mega": { baseSpecies: "Golurk", stone: "Golurkite", confirmed: true },
  "Chesnaught-Mega": { baseSpecies: "Chesnaught", stone: "Chesnaughtite", confirmed: true },
  "Delphox-Mega": { baseSpecies: "Delphox", stone: "Delphoxite", confirmed: true },
  "Greninja-Mega": { baseSpecies: "Greninja", stone: "Greninjite", confirmed: true },
  "Floette-Mega": { baseSpecies: "Floette-Eternal", stone: "Floettite", confirmed: true },
  "Meowstic-M-Mega": { baseSpecies: "Meowstic", stone: "Meowsticite", confirmed: true },
  "Meowstic-F-Mega": { baseSpecies: "Meowstic-F", stone: "Meowsticite", confirmed: true },
  "Hawlucha-Mega": { baseSpecies: "Hawlucha", stone: "Hawluchanite", confirmed: true },
  "Crabominable-Mega": { baseSpecies: "Crabominable", stone: "Crabominite", confirmed: true },
  "Drampa-Mega": { baseSpecies: "Drampa", stone: "Drampanite", confirmed: true },
  "Scovillain-Mega": { baseSpecies: "Scovillain", stone: "Scovillainite", confirmed: true },
  "Glimmora-Mega": { baseSpecies: "Glimmora", stone: "Glimmoranite", confirmed: true },
};

const M_A: Regulation = {
  id: "m-a",
  label: "Champions Reg M-A",
  formatId: "champions-reg-m-a",
  rules: M_A_RULES,
  points: POINTS,
  pokemon: M_A_POKEMON,
  notInPokemon: M_A_NOT_IN,
  itemsConfirmed: M_A_ITEMS_CONFIRMED,
  itemsUncertain: M_A_ITEMS_UNCERTAIN,
  itemsBanned: M_A_ITEMS_BANNED,
  megas: M_A_MEGAS,
  unavailableMoves: UNAVAILABLE_MOVES,
};

// ===========================================================================
// REGULATION M-B  (additive delta over M-A)
// See docs/agent-knowledge/regulation-m-b.md. Synced 2026-06-17.
// ===========================================================================

/** 22 base species newly legal in M-B. */
const M_B_ADDED_POKEMON: string[] = [
  "Vileplume", "Qwilfish", "Sceptile", "Blaziken", "Swampert", "Mawile",
  "Metagross", "Staraptor", "Musharna", "Scolipede", "Scrafty", "Eelektross",
  "Pyroar", "Malamar", "Barbaracle", "Dragalge", "Grimmsnarl", "Falinks",
  "Overqwil", "Houndstone", "Annihilape", "Gholdengo",
];

/** Species that were in M-A's banlist but are LEGAL in M-B. */
const M_B_UNBANNED_SPECIES: string[] = ["Metagross", "Grimmsnarl", "Gholdengo"];

/** Items newly available in M-B (mega stones + general items). */
const M_B_ADDED_ITEMS: string[] = [
  // New mega stones (canonical)
  "Sceptilite", "Blazikenite", "Swampertite", "Mawilite", "Metagrossite",
  "Raichunite X", "Raichunite Y",
  // New mega stones (invented Z-A — from Bulbapedia/Mega_Stone)
  "Staraptite", "Scolipite", "Scraftinite", "Eelektrossite", "Pyroarite",
  "Malamarite", "Barbaracite", "Dragalgite", "Falinksite",
  // General held items added in M-B (Serebii "newly added")
  "Life Orb", "Wide Lens", "Muscle Band", "Wise Glasses", "Expert Belt",
  "Light Clay", "Zoom Lens", "Metronome", "Iron Ball", "Icy Rock",
  "Smooth Rock", "Heat Rock", "Damp Rock", "Shed Shell", "Big Root",
];

/** Items that were banned in M-A but are LEGAL in M-B. */
const M_B_UNBANNED_ITEMS: string[] = [
  "Life Orb", "Wide Lens", "Muscle Band", "Light Clay",
  "Damp Rock", "Heat Rock", "Smooth Rock", "Icy Rock",
];

/** 14 new Mega Evolutions in M-B (Raichu megas already exist in M-A). */
const M_B_ADDED_MEGAS: Record<string, ChampionsMegaInfo> = {
  "Sceptile-Mega": { baseSpecies: "Sceptile", stone: "Sceptilite", confirmed: true },
  "Blaziken-Mega": { baseSpecies: "Blaziken", stone: "Blazikenite", confirmed: true },
  "Swampert-Mega": { baseSpecies: "Swampert", stone: "Swampertite", confirmed: true },
  "Mawile-Mega": { baseSpecies: "Mawile", stone: "Mawilite", confirmed: true },
  "Metagross-Mega": { baseSpecies: "Metagross", stone: "Metagrossite", confirmed: true },
  "Staraptor-Mega": { baseSpecies: "Staraptor", stone: "Staraptite", confirmed: true },
  "Scolipede-Mega": { baseSpecies: "Scolipede", stone: "Scolipite", confirmed: true },
  "Scrafty-Mega": { baseSpecies: "Scrafty", stone: "Scraftinite", confirmed: true },
  "Eelektross-Mega": { baseSpecies: "Eelektross", stone: "Eelektrossite", confirmed: true },
  "Pyroar-Mega": { baseSpecies: "Pyroar", stone: "Pyroarite", confirmed: true },
  "Malamar-Mega": { baseSpecies: "Malamar", stone: "Malamarite", confirmed: true },
  "Barbaracle-Mega": { baseSpecies: "Barbaracle", stone: "Barbaracite", confirmed: true },
  "Dragalge-Mega": { baseSpecies: "Dragalge", stone: "Dragalgite", confirmed: true },
  "Falinks-Mega": { baseSpecies: "Falinks", stone: "Falinksite", confirmed: true },
};

const M_B: Regulation = {
  id: "m-b",
  label: "Champions Reg M-B",
  formatId: "champions-reg-m-b",
  rules: { ...M_A_RULES, period: "June 17 - September 2, 2026" },
  points: POINTS,
  pokemon: [...M_A_POKEMON, ...M_B_ADDED_POKEMON],
  notInPokemon: M_A_NOT_IN.filter((p) => !M_B_UNBANNED_SPECIES.includes(p)),
  itemsConfirmed: [...M_A_ITEMS_CONFIRMED, ...M_B_ADDED_ITEMS],
  itemsUncertain: [],
  itemsBanned: M_A_ITEMS_BANNED.filter((i) => !M_B_UNBANNED_ITEMS.includes(i)),
  megas: { ...M_A_MEGAS, ...M_B_ADDED_MEGAS },
  unavailableMoves: UNAVAILABLE_MOVES,
};

// ---------------------------------------------------------------------------
// Mega signature abilities
// ---------------------------------------------------------------------------

/**
 * The in-game Ability a Mega Evolution has in Champions, keyed by canonical
 * mega form name. Needed because @pkmn/dex only knows the BASE form's
 * ability for the invented Z-A megas (e.g. it reports Eelektross-Mega as
 * "Levitate" — its real Champions ability is "Eelevate").
 *
 * Real Gen-6 ORAS megas are intentionally omitted — @pkmn/dex already has
 * their abilities correct (Sceptile-Mega → Lightning Rod, etc.).
 *
 * Source of truth: serebii.net/pokemonchampions/megaabilities.shtml
 * (synced 2026-06-17). Reg-independent — a mega's ability is the same in
 * every regulation it appears in.
 */
export const CHAMPIONS_MEGA_ABILITIES: Record<string, string> = {
  // Signature megas available since M-A
  "Raichu-Mega-X": "Electric Surge",
  "Raichu-Mega-Y": "No Guard",
  "Clefable-Mega": "Magic Bounce",
  "Victreebel-Mega": "Innards Out",
  "Starmie-Mega": "Huge Power",
  "Dragonite-Mega": "Multiscale",
  "Meganium-Mega": "Mega Sol",
  "Feraligatr-Mega": "Dragonize",
  "Skarmory-Mega": "Stalwart",
  "Chimecho-Mega": "Levitate",
  "Froslass-Mega": "Snow Warning",
  "Emboar-Mega": "Mold Breaker",
  "Excadrill-Mega": "Piercing Drill",
  "Chandelure-Mega": "Infiltrator",
  "Golurk-Mega": "Unseen Fist",
  "Chesnaught-Mega": "Bulletproof",
  "Delphox-Mega": "Levitate",
  "Greninja-Mega": "Protean",
  "Floette-Mega": "Fairy Aura",
  "Meowstic-M-Mega": "Trace",
  "Meowstic-F-Mega": "Trace",
  "Hawlucha-Mega": "No Guard",
  "Crabominable-Mega": "Iron Fist",
  "Drampa-Mega": "Berserk",
  "Scovillain-Mega": "Spicy Spray",
  "Glimmora-Mega": "Adaptability",
  // Signature megas new in M-B
  "Staraptor-Mega": "Contrary",
  "Scolipede-Mega": "Shell Armor",
  "Scrafty-Mega": "Intimidate",
  "Eelektross-Mega": "Eelevate",
  "Pyroar-Mega": "Fire Mane",
  "Malamar-Mega": "Contrary",
  "Barbaracle-Mega": "Tough Claws",
  "Dragalge-Mega": "Regenerator",
  "Falinks-Mega": "Defiant",
};

// ===========================================================================
// Registry + active regulation
// ===========================================================================

export const REGULATIONS: Record<RegulationId, Regulation> = {
  "m-a": M_A,
  "m-b": M_B,
};

/** The current season. All format-less helper calls resolve to this. */
export const ACTIVE_REGULATION: RegulationId = "m-b";

/**
 * Human-facing label for the active regulation, e.g. "Champions Reg M-B".
 * Prefer interpolating this into prompts / UI / tool descriptions over
 * hardcoding the regulation name, so a season change is a one-line update.
 */
export const ACTIVE_REGULATION_LABEL: string = REGULATIONS[ACTIVE_REGULATION].label;

/** Canonical format id for the active regulation, e.g. "champions-reg-m-b". */
export const ACTIVE_REGULATION_FORMAT_ID: string =
  REGULATIONS[ACTIVE_REGULATION].formatId;

/** All selectable regulations, newest first — for UI format dropdowns. */
export const REGULATION_OPTIONS: ReadonlyArray<{
  id: RegulationId;
  label: string;
  formatId: string;
}> = [M_B, M_A].map((r) => ({ id: r.id, label: r.label, formatId: r.formatId }));

/**
 * Map a free-form format string (e.g. "Champions Reg M-A",
 * "champions-reg-m-b") to a regulation id. Falls back to ACTIVE_REGULATION
 * when the format is missing or unrecognised.
 */
export function resolveRegulationId(format?: string | null): RegulationId {
  if (format) {
    const f = format.toLowerCase();
    if (f.includes("m-b")) return "m-b";
    if (f.includes("m-a")) return "m-a";
  }
  return ACTIVE_REGULATION;
}

/** Resolve a full Regulation object from a format string (or the active one). */
export function getRegulation(format?: string | null): Regulation {
  return REGULATIONS[resolveRegulationId(format)];
}

// ---------------------------------------------------------------------------
// Back-compat exports — resolve to the ACTIVE regulation. Existing callers
// that don't care about a specific regulation keep working unchanged.
// ---------------------------------------------------------------------------
const ACTIVE = REGULATIONS[ACTIVE_REGULATION];
export const CHAMPIONS_RULES = ACTIVE.rules;
export const CHAMPIONS_POINTS = ACTIVE.points;
export const CHAMPIONS_POKEMON = ACTIVE.pokemon;
export const NOT_IN_CHAMPIONS = ACTIVE.notInPokemon;
export const CHAMPIONS_ITEMS_CONFIRMED = ACTIVE.itemsConfirmed;
export const CHAMPIONS_ITEMS_UNCERTAIN = ACTIVE.itemsUncertain;
export const CHAMPIONS_ITEMS_BANNED = ACTIVE.itemsBanned;
export const CHAMPIONS_MEGAS = ACTIVE.megas;
export const CHAMPIONS_UNAVAILABLE_MOVES = ACTIVE.unavailableMoves;

/**
 * Pokemon that exist in Champions but CANNOT Mega Evolve.
 * (Currently empty — every roster Pokemon with a stone can mega.)
 */
export const NO_MEGA_DESPITE_BASE: string[] = [];

// ---------------------------------------------------------------------------
// Helpers — all accept an optional `format` to target a specific regulation.
// ---------------------------------------------------------------------------

const CHAMPIONS_SPECIES_ALIASES: Record<string, string> = {
  "floette": "floette-eternal",
  "eternal floette": "floette-eternal",
  "eternal flower floette": "floette-eternal",
  "meowstic-female": "meowstic-f",
  "basculegion-female": "basculegion-f",
  "gourgeist-jumbo": "gourgeist-super",
};

function normalizeChampionsSpeciesName(species: string): string {
  const normalized = species.trim().toLowerCase();
  return CHAMPIONS_SPECIES_ALIASES[normalized] ?? normalized;
}

export function isChampionsPokemon(species: string, format?: string | null): boolean {
  const normalized = normalizeChampionsSpeciesName(species);
  return getRegulation(format).pokemon.some(
    (p) => normalizeChampionsSpeciesName(p) === normalized,
  );
}

export function isChampionsItem(item: string, format?: string | null): boolean {
  const reg = getRegulation(format);
  const itemLc = item.toLowerCase();
  return (
    reg.itemsConfirmed.some((i) => i.toLowerCase() === itemLc) ||
    reg.itemsUncertain.some((i) => i.toLowerCase() === itemLc)
  );
}

export function isConfirmedNotInChampions(
  species: string,
  format?: string | null,
): boolean {
  const normalized = normalizeChampionsSpeciesName(species);
  return getRegulation(format).notInPokemon.some(
    (p) => normalizeChampionsSpeciesName(p) === normalized,
  );
}

export function canMegaEvolve(species: string, format?: string | null): boolean {
  return getChampionsMegaEntriesForSpecies(species, format).length > 0;
}

export function getChampionsMegaEntriesForSpecies(
  species: string,
  format?: string | null,
): Array<{
  megaSpecies: string;
  baseSpecies: string;
  stone: string;
  confirmed: boolean;
}> {
  const normalized = normalizeChampionsSpeciesName(species);
  if (!normalized) return [];

  return Object.entries(getRegulation(format).megas)
    .filter(
      ([, info]) =>
        normalizeChampionsSpeciesName(info.baseSpecies) === normalized,
    )
    .map(([megaSpecies, info]) => ({
      megaSpecies,
      baseSpecies: info.baseSpecies,
      stone: info.stone,
      confirmed: info.confirmed,
    }));
}

/**
 * Look up the Mega Stone → mega species name mapping for a regulation.
 * Returns the @pkmn-canonical Mega form name when the held item triggers
 * Mega Evolution for the given base species; otherwise null.
 *
 * Examples:
 *   getMegaFormFor("Garchomp", "Garchompite")    → "Garchomp-Mega"
 *   getMegaFormFor("Metagross", "Metagrossite", "champions-reg-m-b") → "Metagross-Mega"
 *   getMegaFormFor("Metagross", "Metagrossite", "champions-reg-m-a") → null
 */
export function getMegaFormFor(
  species: string,
  item: string | undefined | null,
  format?: string | null,
): string | null {
  if (!species || !item) return null;
  const itemLc = item.trim().toLowerCase();
  return (
    getChampionsMegaEntriesForSpecies(species, format).find(
      (entry) => entry.stone.toLowerCase() === itemLc,
    )?.megaSpecies ?? null
  );
}

/**
 * The Champions signature Ability for a canonical mega form name
 * (e.g. "Eelektross-Mega" → "Eelevate"), or null when @pkmn/dex already
 * has the correct ability (real Gen-6 megas) or the form isn't a mega.
 */
export function getMegaAbility(megaSpecies: string | null | undefined): string | null {
  if (!megaSpecies) return null;
  return CHAMPIONS_MEGA_ABILITIES[megaSpecies] ?? null;
}

/**
 * Convenience for the team builder: given a base species + held item, the
 * Mega's signature ability if the held stone triggers a mega that has one.
 *
 * Example: getMegaAbilityFor("Eelektross", "Eelektrossite") → "Eelevate"
 */
export function getMegaAbilityFor(
  species: string,
  item: string | undefined | null,
  format?: string | null,
): string | null {
  return getMegaAbility(getMegaFormFor(species, item, format));
}

/**
 * Case-insensitive lookup for a regulation's unavailable-moves table.
 * Returns the canonical-cased blocked list for a species (empty if none).
 */
export function getUnavailableMovesFor(
  species: string,
  format?: string | null,
): string[] {
  const table = getRegulation(format).unavailableMoves;
  const base = species.replace(/-Mega(-[XY])?$/i, "").trim();
  const direct = table[base];
  if (direct) return direct;
  const ci = Object.entries(table).find(
    ([k]) => k.toLowerCase() === base.toLowerCase(),
  );
  return ci ? ci[1] : [];
}

/**
 * Returns true if `move` is explicitly blocked for `species`.
 * Case/whitespace-insensitive.
 */
export function isMoveBlockedForSpecies(
  species: string,
  move: string,
  format?: string | null,
): boolean {
  const blocked = getUnavailableMovesFor(species, format);
  const needle = move.trim().toLowerCase();
  return blocked.some((m) => m.toLowerCase() === needle);
}
