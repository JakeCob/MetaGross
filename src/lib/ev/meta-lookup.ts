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
const META_THREATS: MetaThreat[] = [
  {
    species: "Metagross-Mega",
    usagePercent: 62.3,
    commonSets: [
      makeSet({
        species: "Metagross",
        ability: "Clear Body",
        item: "Metagrossite",
        nature: "Adamant",
        moves: ["Iron Head", "Stomping Tantrum", "Ice Punch", "Protect"],
        evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 },
      }),
      makeSet({
        species: "Metagross",
        ability: "Clear Body",
        item: "Metagrossite",
        nature: "Jolly",
        moves: ["Iron Head", "Stomping Tantrum", "Ice Punch", "Protect"],
        evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
      }),
    ],
  },
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
    species: "Gardevoir-Mega",
    usagePercent: 38.1,
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
    usagePercent: 35.8,
    commonSets: [
      makeSet({
        species: "Charizard",
        ability: "Blaze",
        item: "Charizardite Y",
        nature: "Timid",
        moves: ["Heat Wave", "Solar Beam", "Air Slash", "Protect"],
        evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      }),
    ],
  },
  {
    species: "Kyogre",
    usagePercent: 33.4,
    commonSets: [
      makeSet({
        species: "Kyogre",
        ability: "Drizzle",
        item: "Mystic Water",
        nature: "Modest",
        moves: ["Water Spout", "Origin Pulse", "Ice Beam", "Protect"],
        evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      }),
    ],
  },
  {
    species: "Tornadus",
    usagePercent: 30.5,
    commonSets: [
      makeSet({
        species: "Tornadus",
        ability: "Prankster",
        item: "Focus Sash",
        nature: "Timid",
        moves: ["Bleakwind Storm", "Tailwind", "Rain Dance", "Protect"],
        evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      }),
    ],
  },
  {
    species: "Amoonguss",
    usagePercent: 28.9,
    commonSets: [
      makeSet({
        species: "Amoonguss",
        ability: "Regenerator",
        item: "Coba Berry",
        nature: "Relaxed",
        moves: ["Spore", "Rage Powder", "Pollen Puff", "Protect"],
        evs: { hp: 252, atk: 0, def: 148, spa: 0, spd: 108, spe: 0 },
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
  {
    species: "Kangaskhan-Mega",
    usagePercent: 25.3,
    commonSets: [
      makeSet({
        species: "Kangaskhan",
        ability: "Scrappy",
        item: "Kangaskhanite",
        nature: "Jolly",
        moves: ["Return", "Fake Out", "Sucker Punch", "Protect"],
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
 * Returns hardcoded data for now.
 */
export function getMetaThreats(
  _format: string = "champions-reg-m-a",
): MetaThreat[] {
  return META_THREATS;
}

// ---------------------------------------------------------------------------
// NOTE: getEnrichedMetaSpreads is in meta-enriched-lookup.ts (server-only)
// to avoid pulling DB/search deps into client bundles.
// ---------------------------------------------------------------------------
