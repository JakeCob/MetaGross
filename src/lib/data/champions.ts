/**
 * Pokemon Champions Regulation M-A game data.
 *
 * Sourced from Pikalytics competitive usage data (championspreview format).
 * This is the confirmed pool of Pokemon and items used in competitive play.
 * Not exhaustive — only includes Pokemon/items with competitive usage.
 */

/** Pokemon confirmed available in Champions Reg M-A (from Pikalytics top 50) */
export const CHAMPIONS_POKEMON: string[] = [
  "Incineroar",
  "Sneasler",
  "Sinistcha",
  "Sinistcha-Masterpiece",
  "Archaludon",
  "Whimsicott",
  "Pelipper",
  "Garchomp",
  "Farigiraf",
  "Dragonite",
  "Charizard",
  "Basculegion",
  "Tyranitar",
  "Kingambit",
  "Gengar",
  "Metagross",
  "Froslass",
  "Venusaur",
  "Primarina",
  "Rotom-Wash",
  "Corviknight",
  "Excadrill",
  "Gardevoir",
  "Milotic",
  "Dragapult",
  "Talonflame",
  "Torkoal",
  "Dondozo",
  "Clefable",
  "Arcanine-Hisui",
  "Maushold",
  "Maushold-Four",
  "Gyarados",
  "Salamence",
  "Meganium",
  "Meowscarada",
  "Politoed",
  "Meowstic-F",
  "Volcarona",
  "Tatsugiri",
  "Ninetales-Alola",
  "Grimmsnarl",
  "Aegislash",
  "Delphox",
  "Kommo-o",
  "Kangaskhan",
  "Glimmora",
  "Palafin-Hero",
  "Raichu",
  "Sylveon",
];

/** Items confirmed available in Champions Reg M-A (from Pikalytics usage) */
export const CHAMPIONS_ITEMS: string[] = [
  "Adrenaline Orb",
  "Aguav Berry",
  "Air Balloon",
  "Assault Vest",
  "Black Glasses",
  "Black Sludge",
  "Charizardite X",
  "Charizardite Y",
  "Choice Band",
  "Choice Scarf",
  "Choice Specs",
  "Chople Berry",
  "Clear Amulet",
  "Colbur Berry",
  "Covert Cloak",
  "Damp Rock",
  "Dragoninite", // Dragonite's Mega Stone
  "Eject Button",
  "Eject Pack",
  "Figy Berry",
  "Focus Sash",
  "Garchompite",
  "Gengarite",
  "Leftovers",
  "Life Orb",
  "Loaded Dice",
  "Lum Berry",
  "Mental Herb",
  "Metagrossite",
  "Mirror Herb",
  "Muscle Band",
  "Normal Gem",
  "Occa Berry",
  "Power Herb",
  "Psychic Seed",
  "Razor Fang",
  "Rocky Helmet",
  "Room Service",
  "Safety Goggles",
  "Shuca Berry",
  "Sitrus Berry",
  "Throat Spray",
  "Toxic Orb",
  "Tyranitarite",
  "Venusaurite",
  "Weakness Policy",
  "White Herb",
  "Wide Lens",
];

/** Mega Stones and their Pokemon */
export const CHAMPIONS_MEGA_STONES: Record<string, string> = {
  Charizardite_X: "Charizard",
  Charizardite_Y: "Charizard",
  Dragoninite: "Dragonite",
  Garchompite: "Garchomp",
  Gengarite: "Gengar",
  Metagrossite: "Metagross",
  Tyranitarite: "Tyranitar",
  Venusaurite: "Venusaur",
};

/** Champions point system (replaces traditional EVs) */
export const CHAMPIONS_POINTS = {
  totalMax: 66,
  perStatMax: 32,
  label: "Points",
};

/** Check if a Pokemon is available in Champions */
export function isChampionsPokemon(species: string): boolean {
  return CHAMPIONS_POKEMON.some(
    (p) => p.toLowerCase() === species.toLowerCase(),
  );
}

/** Check if an item is available in Champions */
export function isChampionsItem(item: string): boolean {
  return CHAMPIONS_ITEMS.some(
    (i) => i.toLowerCase() === item.toLowerCase(),
  );
}
