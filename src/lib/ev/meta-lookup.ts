/**
 * Meta spread data lookup.
 *
 * Hardcoded top Champions Reg M-A meta threats with common EV spreads.
 * This will be replaced with Pikalytics API integration later.
 */

import type { MetaSpread } from "@/lib/types/ev";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { DEFAULT_IVS, DEFAULT_EVS } from "@/lib/types/pokemon";

// ---------------------------------------------------------------------------
// MetaThreat interface (used by benchmark engine)
// ---------------------------------------------------------------------------
export interface MetaThreat {
  species: string;
  commonSets: TeamPokemon[];
  usagePercent: number;
}

// ---------------------------------------------------------------------------
// Helper to build a TeamPokemon
// ---------------------------------------------------------------------------
function makeSet(overrides: Partial<TeamPokemon>): TeamPokemon {
  return {
    species: overrides.species ?? "Metagross",
    ability: overrides.ability ?? "Clear Body",
    item: overrides.item ?? "",
    nature: overrides.nature ?? "Hardy",
    level: 50,
    moves: overrides.moves ?? ["", "", "", ""],
    evs: overrides.evs ?? { ...DEFAULT_EVS },
    ivs: overrides.ivs ?? { ...DEFAULT_IVS },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Hardcoded meta spreads by species
// ---------------------------------------------------------------------------
const META_SPREADS: Record<string, MetaSpread[]> = {
  "Metagross-Mega": [
    {
      evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 },
      nature: "Adamant",
      usagePercent: 35.2,
      source: "manual",
      rank: 1,
    },
    {
      evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
      nature: "Jolly",
      usagePercent: 28.1,
      source: "manual",
      rank: 2,
    },
    {
      evs: { hp: 252, atk: 140, def: 4, spa: 0, spd: 76, spe: 36 },
      nature: "Adamant",
      usagePercent: 15.3,
      source: "manual",
      rank: 3,
    },
  ],
  Metagross: [
    {
      evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 },
      nature: "Adamant",
      usagePercent: 35.2,
      source: "manual",
      rank: 1,
    },
    {
      evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
      nature: "Jolly",
      usagePercent: 28.1,
      source: "manual",
      rank: 2,
    },
    {
      evs: { hp: 252, atk: 140, def: 4, spa: 0, spd: 76, spe: 36 },
      nature: "Adamant",
      usagePercent: 15.3,
      source: "manual",
      rank: 3,
    },
  ],
  Incineroar: [
    {
      evs: { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 },
      nature: "Careful",
      usagePercent: 40.5,
      source: "manual",
      rank: 1,
    },
    {
      evs: { hp: 252, atk: 0, def: 108, spa: 0, spd: 148, spe: 0 },
      nature: "Careful",
      usagePercent: 22.3,
      source: "manual",
      rank: 2,
    },
    {
      evs: { hp: 244, atk: 36, def: 76, spa: 0, spd: 148, spe: 4 },
      nature: "Careful",
      usagePercent: 12.1,
      source: "manual",
      rank: 3,
    },
  ],
  Rillaboom: [
    {
      evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 },
      nature: "Adamant",
      usagePercent: 38.7,
      source: "manual",
      rank: 1,
    },
    {
      evs: { hp: 252, atk: 148, def: 4, spa: 0, spd: 100, spe: 4 },
      nature: "Adamant",
      usagePercent: 18.4,
      source: "manual",
      rank: 2,
    },
    {
      evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
      nature: "Jolly",
      usagePercent: 14.2,
      source: "manual",
      rank: 3,
    },
  ],
  "Gardevoir-Mega": [
    {
      evs: { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 },
      nature: "Modest",
      usagePercent: 32.0,
      source: "manual",
      rank: 1,
    },
    {
      evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      nature: "Timid",
      usagePercent: 27.5,
      source: "manual",
      rank: 2,
    },
    {
      evs: { hp: 252, atk: 0, def: 76, spa: 132, spd: 44, spe: 4 },
      nature: "Modest",
      usagePercent: 11.8,
      source: "manual",
      rank: 3,
    },
  ],
  "Charizard-Mega-Y": [
    {
      evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      nature: "Timid",
      usagePercent: 36.1,
      source: "manual",
      rank: 1,
    },
    {
      evs: { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 },
      nature: "Modest",
      usagePercent: 25.8,
      source: "manual",
      rank: 2,
    },
    {
      evs: { hp: 108, atk: 0, def: 76, spa: 196, spd: 4, spe: 124 },
      nature: "Modest",
      usagePercent: 10.4,
      source: "manual",
      rank: 3,
    },
  ],
  Kyogre: [
    {
      evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      nature: "Modest",
      usagePercent: 33.9,
      source: "manual",
      rank: 1,
    },
    {
      evs: { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 },
      nature: "Quiet",
      usagePercent: 22.7,
      source: "manual",
      rank: 2,
    },
    {
      evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      nature: "Timid",
      usagePercent: 18.1,
      source: "manual",
      rank: 3,
    },
  ],
  Tornadus: [
    {
      evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      nature: "Timid",
      usagePercent: 42.3,
      source: "manual",
      rank: 1,
    },
    {
      evs: { hp: 252, atk: 0, def: 100, spa: 4, spd: 148, spe: 4 },
      nature: "Bold",
      usagePercent: 20.1,
      source: "manual",
      rank: 2,
    },
    {
      evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      nature: "Modest",
      usagePercent: 12.5,
      source: "manual",
      rank: 3,
    },
  ],
  Amoonguss: [
    {
      evs: { hp: 252, atk: 0, def: 148, spa: 0, spd: 108, spe: 0 },
      nature: "Relaxed",
      usagePercent: 35.6,
      source: "manual",
      rank: 1,
    },
    {
      evs: { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 },
      nature: "Bold",
      usagePercent: 20.8,
      source: "manual",
      rank: 2,
    },
    {
      evs: { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 },
      nature: "Calm",
      usagePercent: 15.3,
      source: "manual",
      rank: 3,
    },
  ],
  Garchomp: [
    {
      evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
      nature: "Jolly",
      usagePercent: 38.4,
      source: "manual",
      rank: 1,
    },
    {
      evs: { hp: 252, atk: 0, def: 108, spa: 0, spd: 148, spe: 0 },
      nature: "Impish",
      usagePercent: 22.6,
      source: "manual",
      rank: 2,
    },
    {
      evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 },
      nature: "Adamant",
      usagePercent: 15.1,
      source: "manual",
      rank: 3,
    },
  ],
  "Kangaskhan-Mega": [
    {
      evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
      nature: "Jolly",
      usagePercent: 34.2,
      source: "manual",
      rank: 1,
    },
    {
      evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 },
      nature: "Adamant",
      usagePercent: 26.8,
      source: "manual",
      rank: 2,
    },
    {
      evs: { hp: 100, atk: 252, def: 4, spa: 0, spd: 12, spe: 140 },
      nature: "Adamant",
      usagePercent: 12.5,
      source: "manual",
      rank: 3,
    },
  ],
};

// ---------------------------------------------------------------------------
// Meta threat data (common sets for each threat)
// ---------------------------------------------------------------------------

/**
 * Champions Reg M-A top threats (sourced from Pikalytics championspreview
 * + known meta reporting). EVs are written in traditional 252-scale since
 * the damage engine expects that; Champions slots convert from points at
 * call-sites.
 */
const CHAMPIONS_THREATS: MetaThreat[] = [
  {
    species: "Incineroar",
    usagePercent: 68.9,
    commonSets: [
      makeSet({
        species: "Incineroar",
        ability: "Intimidate",
        item: "Safety Goggles",
        nature: "Careful",
        moves: ["Fake Out", "Flare Blitz", "Knock Off", "Parting Shot"],
        evs: { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 },
      }),
    ],
  },
  {
    species: "Sneasler",
    usagePercent: 41.2,
    commonSets: [
      makeSet({
        species: "Sneasler",
        ability: "Unburden",
        item: "Focus Sash",
        nature: "Jolly",
        moves: ["Close Combat", "Dire Claw", "Acrobatics", "Protect"],
        evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
      }),
    ],
  },
  {
    species: "Archaludon",
    usagePercent: 39.4,
    commonSets: [
      makeSet({
        species: "Archaludon",
        ability: "Stamina",
        item: "Assault Vest",
        nature: "Modest",
        moves: ["Electro Shot", "Draco Meteor", "Flash Cannon", "Body Press"],
        evs: { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 },
      }),
    ],
  },
  {
    species: "Pelipper",
    usagePercent: 33.8,
    commonSets: [
      makeSet({
        species: "Pelipper",
        ability: "Drizzle",
        item: "Focus Sash",
        nature: "Modest",
        moves: ["Hurricane", "Weather Ball", "Tailwind", "Protect"],
        evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      }),
    ],
  },
  {
    species: "Whimsicott",
    usagePercent: 31.5,
    commonSets: [
      makeSet({
        species: "Whimsicott",
        ability: "Prankster",
        item: "Covert Cloak",
        nature: "Timid",
        moves: ["Tailwind", "Moonblast", "Encore", "Helping Hand"],
        evs: { hp: 252, atk: 0, def: 4, spa: 0, spd: 0, spe: 252 },
      }),
    ],
  },
  {
    species: "Farigiraf",
    usagePercent: 27.6,
    commonSets: [
      makeSet({
        species: "Farigiraf",
        ability: "Armor Tail",
        item: "Mental Herb",
        nature: "Sassy",
        moves: ["Trick Room", "Psychic Noise", "Helping Hand", "Hyper Voice"],
        evs: { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 },
      }),
    ],
  },
  {
    species: "Garchomp",
    usagePercent: 25.1,
    commonSets: [
      makeSet({
        species: "Garchomp",
        ability: "Rough Skin",
        item: "Life Orb",
        nature: "Jolly",
        moves: ["Earthquake", "Dragon Claw", "Rock Slide", "Protect"],
        evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
      }),
    ],
  },
  {
    species: "Dragonite",
    usagePercent: 24.3,
    commonSets: [
      makeSet({
        species: "Dragonite",
        ability: "Inner Focus",
        item: "Dragoninite",
        nature: "Adamant",
        moves: ["Extreme Speed", "Scale Shot", "Ice Spinner", "Protect"],
        evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
      }),
    ],
  },
  {
    species: "Kingambit",
    usagePercent: 22.7,
    commonSets: [
      makeSet({
        species: "Kingambit",
        ability: "Defiant",
        item: "Black Glasses",
        nature: "Adamant",
        moves: ["Sucker Punch", "Kowtow Cleave", "Swords Dance", "Protect"],
        evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 },
      }),
    ],
  },
  {
    species: "Tyranitar-Mega",
    usagePercent: 20.9,
    commonSets: [
      makeSet({
        species: "Tyranitar",
        ability: "Sand Stream",
        item: "Tyranitarite",
        nature: "Adamant",
        moves: ["Rock Slide", "Crunch", "Ice Punch", "Protect"],
        evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 },
      }),
    ],
  },
  {
    species: "Metagross-Mega",
    usagePercent: 19.4,
    commonSets: [
      makeSet({
        species: "Metagross",
        ability: "Tough Claws",
        item: "Metagrossite",
        nature: "Jolly",
        moves: ["Iron Head", "Psychic Fangs", "Stomping Tantrum", "Protect"],
        evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
      }),
    ],
  },
  {
    species: "Gardevoir-Mega",
    usagePercent: 17.1,
    commonSets: [
      makeSet({
        species: "Gardevoir",
        ability: "Trace",
        item: "Gardevoirite",
        nature: "Modest",
        moves: ["Hyper Voice", "Psychic", "Mystical Fire", "Protect"],
        evs: { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 },
      }),
    ],
  },
  {
    species: "Charizard-Mega-Y",
    usagePercent: 15.8,
    commonSets: [
      makeSet({
        species: "Charizard",
        ability: "Drought",
        item: "Charizardite Y",
        nature: "Timid",
        moves: ["Heat Wave", "Solar Beam", "Air Slash", "Protect"],
        evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      }),
    ],
  },
  {
    species: "Rillaboom",
    usagePercent: 14.6,
    commonSets: [
      makeSet({
        species: "Rillaboom",
        ability: "Grassy Surge",
        item: "Assault Vest",
        nature: "Adamant",
        moves: ["Wood Hammer", "Grassy Glide", "Fake Out", "U-turn"],
        evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 },
      }),
    ],
  },
];

/**
 * Legacy VGC 2016-era threats — kept for non-Champions formats.
 */
const LEGACY_THREATS: MetaThreat[] = [
  {
    species: "Incineroar",
    usagePercent: 58.7,
    commonSets: [
      makeSet({
        species: "Incineroar",
        ability: "Intimidate",
        item: "Safety Goggles",
        nature: "Careful",
        moves: ["Flare Blitz", "Fake Out", "Knock Off", "Parting Shot"],
        evs: { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 },
      }),
    ],
  },
  {
    species: "Rillaboom",
    usagePercent: 45.2,
    commonSets: [
      makeSet({
        species: "Rillaboom",
        ability: "Grassy Surge",
        item: "Miracle Seed",
        nature: "Adamant",
        moves: ["Grassy Glide", "Wood Hammer", "Fake Out", "Protect"],
        evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 },
      }),
    ],
  },
  {
    species: "Garchomp",
    usagePercent: 27.6,
    commonSets: [
      makeSet({
        species: "Garchomp",
        ability: "Rough Skin",
        item: "Life Orb",
        nature: "Jolly",
        moves: ["Earthquake", "Dragon Claw", "Rock Slide", "Protect"],
        evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
      }),
    ],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get meta spreads for a specific species in a given format.
 * Returns hardcoded data for now.
 */
export function getMetaSpreads(
  species: string,
  _format: string = "champions-reg-m-a",
): MetaSpread[] {
  return META_SPREADS[species] ?? [];
}

/**
 * Get the top meta threats for a given format.
 * Champions uses the curated Champions Reg M-A list; everything else falls
 * back to the legacy set.
 */
export function getMetaThreats(
  format: string = "champions-reg-m-a",
): MetaThreat[] {
  const normalized = format.toLowerCase();
  if (normalized.includes("champion")) return CHAMPIONS_THREATS;
  return LEGACY_THREATS;
}

// ---------------------------------------------------------------------------
// NOTE: getEnrichedMetaSpreads is in meta-enriched-lookup.ts (server-only)
// to avoid pulling DB/search deps into client bundles.
// ---------------------------------------------------------------------------
