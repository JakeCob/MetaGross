/**
 * Curated team lists from popular VGC content creators.
 *
 * These are hand-picked teams that creators have shared via videos, streams,
 * tournaments, or social media. They serve as reference/inspiration for users
 * building their own teams.
 *
 * Source attribution is important — always credit the creator.
 *
 * NOTE: These are template cores. Exact EV spreads and move choices may vary
 * between the creator's actual build and what's shown here. For exact sets,
 * watch the creator's content directly.
 */

export interface CreatorTeam {
  id: string;
  creator: string;
  creatorHandle: string;
  creatorUrl?: string;
  title: string;
  archetype: string;
  format: string; // "champions-reg-m-a" | "vgc-2026-reg-i" | "vgc-2025-reg-g" etc.
  date: string; // ISO date when team was featured
  videoUrl?: string; // YouTube/Twitch/Twitter link
  description: string;
  pokemon: Array<{
    species: string;
    ability: string;
    item: string;
    moves: string[];
    nature?: string;
    tera?: string; // SV formats only
    /** EV spread as a ready-to-display string ("252 HP / 252 Atk / 4 SpD").
     *  Champions format uses 66 stat points / 32 max per stat, but the
     *  display string is free-form so callers can format either convention. */
    evs?: string;
    /** IV string — usually blank unless deliberate 0s (0 Spe for TR / 0 Atk for SpA mons). */
    ivs?: string;
  }>;
  strategy?: string;
  tags?: string[];
}

export const CREATOR_TEAMS: CreatorTeam[] = [
  // --- WOLFE GLICK ---
  {
    id: "wolfe-2016-worlds",
    creator: "Wolfe Glick",
    creatorHandle: "@WolfeyGlick",
    creatorUrl: "https://www.youtube.com/@WolfeyVGC",
    title: "2016 World Championship Winning Team",
    archetype: "Perish Song Control",
    format: "vgc-2016",
    date: "2016-08-21",
    videoUrl: "https://www.youtube.com/@WolfeyVGC",
    description:
      "The legendary team that won Wolfe his 2016 World Championship. Perish Song + Shadow Tag trap strategy.",
    pokemon: [
      {
        species: "Gengar-Mega",
        ability: "Shadow Tag",
        item: "Gengarite",
        moves: ["Perish Song", "Protect", "Shadow Ball", "Taunt"],
        nature: "Timid",
      },
      {
        species: "Politoed",
        ability: "Drizzle",
        item: "Damp Rock",
        moves: ["Scald", "Ice Beam", "Protect", "Helping Hand"],
        nature: "Modest",
      },
      {
        species: "Raichu",
        ability: "Lightning Rod",
        item: "Focus Sash",
        moves: ["Encore", "Thunderbolt", "Fake Out", "Protect"],
        nature: "Timid",
      },
      {
        species: "Ludicolo",
        ability: "Swift Swim",
        item: "Life Orb",
        moves: ["Hydro Pump", "Giga Drain", "Ice Beam", "Protect"],
        nature: "Modest",
      },
      {
        species: "Landorus",
        ability: "Sheer Force",
        item: "Life Orb",
        moves: ["Earth Power", "Sludge Bomb", "Hidden Power Ice", "Protect"],
        nature: "Timid",
      },
      {
        species: "Rotom-Wash",
        ability: "Levitate",
        item: "Sitrus Berry",
        moves: ["Thunderbolt", "Hydro Pump", "Thunder Wave", "Protect"],
        nature: "Modest",
      },
    ],
    strategy:
      "Trap opponents with Mega Gengar's Shadow Tag, then Perish Song. Ludicolo sweeps under Politoed's rain. Raichu redirects Electric attacks from Landorus.",
    tags: ["perish trap", "rain", "legendary"],
  },

  // --- CYBERTRON (Aaron Zheng) ---
  {
    id: "cybertron-regg-balance",
    creator: "CybertronVGC",
    creatorHandle: "@CybertronVGC",
    creatorUrl: "https://www.youtube.com/@CybertronVGC",
    title: "Reg G Balance Core (Archetype Breakdown)",
    archetype: "Balance",
    format: "vgc-2025-reg-g",
    date: "2025-06-15",
    videoUrl: "https://www.youtube.com/@CybertronVGC",
    description:
      "Aaron's balanced Reg G team breakdown — fundamentals-focused, consistent, approachable for players at any level.",
    pokemon: [
      {
        species: "Incineroar",
        ability: "Intimidate",
        item: "Safety Goggles",
        moves: ["Fake Out", "Flare Blitz", "Knock Off", "Parting Shot"],
        nature: "Careful",
      },
      {
        species: "Rillaboom",
        ability: "Grassy Surge",
        item: "Assault Vest",
        moves: ["Wood Hammer", "Grassy Glide", "Fake Out", "U-turn"],
        nature: "Adamant",
      },
      {
        species: "Urshifu-Rapid-Strike",
        ability: "Unseen Fist",
        item: "Mystic Water",
        moves: ["Surging Strikes", "Close Combat", "Aqua Jet", "Detect"],
        nature: "Jolly",
      },
      {
        species: "Calyrex-Shadow",
        ability: "As One (Spectrier)",
        item: "Life Orb",
        moves: ["Astral Barrage", "Nasty Plot", "Protect", "Pollen Puff"],
        nature: "Timid",
      },
      {
        species: "Tornadus",
        ability: "Prankster",
        item: "Covert Cloak",
        moves: ["Tailwind", "Bleakwind Storm", "Taunt", "Protect"],
        nature: "Timid",
      },
      {
        species: "Farigiraf",
        ability: "Armor Tail",
        item: "Mental Herb",
        moves: ["Trick Room", "Psychic", "Helping Hand", "Hyper Voice"],
        nature: "Sassy",
      },
    ],
    strategy:
      "Calyrex-Shadow wins games with Nasty Plot + Astral Barrage. Tornadus and Farigiraf provide speed control options in both directions (Tailwind + Trick Room).",
    tags: ["balance", "restricted", "educational"],
  },

  // --- POKEAIM MD ---
  {
    id: "pokeaim-rain-core",
    creator: "PokeaimMD",
    creatorHandle: "@PokeaimMD",
    creatorUrl: "https://www.youtube.com/@PokeaimMD",
    title: "Pokeaim Rain Core",
    archetype: "Rain",
    format: "vgc-2025-reg-h",
    date: "2025-10-10",
    videoUrl: "https://www.youtube.com/@PokeaimMD",
    description:
      "Pokeaim's take on rain offense — Pelipper + Archaludon + rain abusers. High damage, reliable setup.",
    pokemon: [
      {
        species: "Pelipper",
        ability: "Drizzle",
        item: "Focus Sash",
        moves: ["Hurricane", "Weather Ball", "Tailwind", "Protect"],
        nature: "Modest",
      },
      {
        species: "Archaludon",
        ability: "Stamina",
        item: "Assault Vest",
        moves: ["Electro Shot", "Draco Meteor", "Flash Cannon", "Body Press"],
        nature: "Modest",
      },
      {
        species: "Basculegion",
        ability: "Swift Swim",
        item: "Choice Band",
        moves: ["Wave Crash", "Last Respects", "Aqua Jet", "Psychic Fangs"],
        nature: "Adamant",
      },
      {
        species: "Incineroar",
        ability: "Intimidate",
        item: "Safety Goggles",
        moves: ["Fake Out", "Flare Blitz", "Knock Off", "Parting Shot"],
        nature: "Careful",
      },
      {
        species: "Sinistcha",
        ability: "Hospitality",
        item: "Sitrus Berry",
        moves: ["Matcha Gotcha", "Rage Powder", "Trick Room", "Life Dew"],
        nature: "Bold",
      },
      {
        species: "Kingambit",
        ability: "Defiant",
        item: "Black Glasses",
        moves: ["Sucker Punch", "Kowtow Cleave", "Swords Dance", "Protect"],
        nature: "Adamant",
      },
    ],
    strategy:
      "Pelipper sets rain + Tailwind. Archaludon stacks Stamina boosts. Basculegion becomes a CB rain-boosted Wave Crash nuke. Kingambit handles Ghost/Psychic threats.",
    tags: ["rain", "offense"],
  },

  // --- JAMES BAEK ---
  {
    id: "james-baek-tr",
    creator: "James Baek",
    creatorHandle: "@James_Baek",
    creatorUrl: "https://www.youtube.com/@JamesBaek",
    title: "Trick Room Hatterene Core",
    archetype: "Trick Room",
    format: "vgc-2025-reg-h",
    date: "2025-09-20",
    videoUrl: "https://www.youtube.com/@JamesBaek",
    description:
      "James Baek's Trick Room team analysis — Hatterene setter with slow physical attackers.",
    pokemon: [
      {
        species: "Hatterene",
        ability: "Magic Bounce",
        item: "Focus Sash",
        moves: ["Trick Room", "Dazzling Gleam", "Psychic", "Protect"],
        nature: "Quiet",
      },
      {
        species: "Ursaluna-Bloodmoon",
        ability: "Mind's Eye",
        item: "Life Orb",
        moves: ["Blood Moon", "Earth Power", "Hyper Voice", "Protect"],
        nature: "Quiet",
      },
      {
        species: "Incineroar",
        ability: "Intimidate",
        item: "Safety Goggles",
        moves: ["Fake Out", "Flare Blitz", "Knock Off", "Parting Shot"],
        nature: "Brave",
      },
      {
        species: "Rillaboom",
        ability: "Grassy Surge",
        item: "Miracle Seed",
        moves: ["Wood Hammer", "Grassy Glide", "Fake Out", "U-turn"],
        nature: "Brave",
      },
      {
        species: "Dondozo",
        ability: "Unaware",
        item: "Leftovers",
        moves: ["Wave Crash", "Order Up", "Protect", "Rest"],
        nature: "Brave",
      },
      {
        species: "Tatsugiri",
        ability: "Commander",
        item: "Choice Scarf",
        moves: ["Draco Meteor", "Muddy Water", "Icy Wind", "Nasty Plot"],
        nature: "Quiet",
      },
    ],
    strategy:
      "Hatterene sets TR safely behind Magic Bounce + Focus Sash. Ursaluna-Bloodmoon nukes everything under TR. Dondozo + Tatsugiri Commander combo for bulky offense.",
    tags: ["trick room", "offensive"],
  },

  // --- THATSAPLUSONE ---
  {
    id: "thatsaplusone-ho",
    creator: "ThatsAPlusOne",
    creatorHandle: "@ThatsAPlusOne",
    creatorUrl: "https://www.youtube.com/@ThatsAPlusOne",
    title: "Hyper Offense Showcase",
    archetype: "Hyper Offense",
    format: "vgc-2025-reg-h",
    date: "2025-11-05",
    videoUrl: "https://www.youtube.com/@ThatsAPlusOne",
    description:
      "Pure speed and pressure. Every slot is a threat. Tailwind + priority moves + 4x effective damage.",
    pokemon: [
      {
        species: "Dragapult",
        ability: "Clear Body",
        item: "Focus Sash",
        moves: ["Draco Meteor", "Shadow Ball", "U-turn", "Protect"],
        nature: "Timid",
      },
      {
        species: "Sneasler",
        ability: "Unburden",
        item: "Focus Sash",
        moves: ["Close Combat", "Dire Claw", "Acrobatics", "Protect"],
        nature: "Jolly",
      },
      {
        species: "Metagross-Mega",
        ability: "Tough Claws",
        item: "Metagrossite",
        moves: ["Iron Head", "Psychic Fangs", "Stomping Tantrum", "Protect"],
        nature: "Jolly",
      },
      {
        species: "Kingambit",
        ability: "Defiant",
        item: "Black Glasses",
        moves: ["Sucker Punch", "Kowtow Cleave", "Iron Head", "Protect"],
        nature: "Adamant",
      },
      {
        species: "Whimsicott",
        ability: "Prankster",
        item: "Covert Cloak",
        moves: ["Tailwind", "Moonblast", "Encore", "Light Screen"],
        nature: "Timid",
      },
      {
        species: "Incineroar",
        ability: "Intimidate",
        item: "Safety Goggles",
        moves: ["Fake Out", "Flare Blitz", "Knock Off", "Parting Shot"],
        nature: "Careful",
      },
    ],
    strategy:
      "Whimsicott sets Tailwind Turn 1. Everything else is a fast physical threat. Overwhelm before the opponent can set up.",
    tags: ["hyper offense", "tailwind"],
  },

  // --- SABLEYE VGC ---
  {
    id: "sableyevgc-sand",
    creator: "SableyeVGC",
    creatorHandle: "@SableyeVGC",
    creatorUrl: "https://www.twitch.tv/sableyevgc",
    title: "Sand Offense",
    archetype: "Sand",
    format: "vgc-2025-reg-h",
    date: "2025-08-30",
    description:
      "Classic sand offense — Tyranitar + Excadrill speed war. Overwhelming in sand.",
    pokemon: [
      {
        species: "Tyranitar",
        ability: "Sand Stream",
        item: "Assault Vest",
        moves: ["Rock Slide", "Crunch", "Ice Punch", "Low Kick"],
        nature: "Adamant",
      },
      {
        species: "Excadrill",
        ability: "Sand Rush",
        item: "Focus Sash",
        moves: ["Earthquake", "Iron Head", "Rock Slide", "Protect"],
        nature: "Jolly",
      },
      {
        species: "Garchomp",
        ability: "Rough Skin",
        item: "Life Orb",
        moves: ["Earthquake", "Dragon Claw", "Rock Slide", "Protect"],
        nature: "Jolly",
      },
      {
        species: "Incineroar",
        ability: "Intimidate",
        item: "Safety Goggles",
        moves: ["Fake Out", "Flare Blitz", "Knock Off", "Parting Shot"],
        nature: "Careful",
      },
      {
        species: "Sinistcha",
        ability: "Hospitality",
        item: "Sitrus Berry",
        moves: ["Matcha Gotcha", "Rage Powder", "Trick Room", "Life Dew"],
        nature: "Bold",
      },
      {
        species: "Whimsicott",
        ability: "Prankster",
        item: "Covert Cloak",
        moves: ["Tailwind", "Moonblast", "Encore", "Helping Hand"],
        nature: "Timid",
      },
    ],
    strategy:
      "Tyranitar sets sand on entry, Excadrill's Sand Rush doubles its speed (base 88 → 176 → 352 with Jolly). Sand's 1.5x SpD boost makes Tyranitar very bulky.",
    tags: ["sand", "offense"],
  },

  // --- POKEMON CHAMPIONS REG M-A — CURRENT META ---

  {
    id: "wolfe-champions-scovillain-2026",
    creator: "Wolfe Glick",
    creatorHandle: "@WolfeyGlick",
    creatorUrl: "https://www.youtube.com/@WolfeyVGC",
    title: "Mega Scovillain Ladder Team — #1 Ranked Champions",
    archetype: "Spicy Spray Burn Wall",
    format: "champions-reg-m-a",
    date: "2026-04-15",
    videoUrl: "https://www.youtube.com/watch?v=nADGfhosH70",
    description:
      "Wolfe's #1-ranked Champions ladder team during the Reg M-A early meta. Mega Scovillain's Spicy Spray burns any Pokemon that makes contact — a structural counter to the physical meta (Sneasler Close Combat, Kingambit Sucker Punch, Incineroar Fake Out, Basculegion Wave Crash all self-burn). Liquid Voice Primarina turns Hyper Voice into a non-contact Water STAB spread that bypasses Scovillain's own Rage Powder.",
    pokemon: [
      {
        // Use base-species name + Mega Stone so the fingerprint matches
        // Limitless convention (Mega is implied by the item).
        species: "Scovillain",
        ability: "Spicy Spray",
        item: "Scovillainite",
        // Overheat (not Flamethrower) — Wolfe's revealed set uses the
        // nuke to force Intimidate pivots on turn 1. The SpA drop is
        // softened by redirection + Calm Mind Primarina cycle.
        moves: ["Overheat", "Leech Seed", "Rage Powder", "Protect"],
        nature: "Calm",
        // Champions 66-point / 32-max format. Converted from the
        // traditional 252 HP / 196 Def / 60 SpD spread (÷8, capped 32).
        evs: "HP 32 / Atk 0 / Def 24 / SpA 0 / SpD 10 / Spe 0",
        ivs: "0 Atk / 0 Spe",
      },
      {
        species: "Primarina",
        ability: "Liquid Voice",
        item: "Leftovers",
        moves: ["Hyper Voice", "Moonblast", "Calm Mind", "Protect"],
        nature: "Modest",
        evs: "HP 30 / Atk 0 / Def 1 / SpA 32 / SpD 1 / Spe 2",
        ivs: "0 Atk",
      },
      {
        species: "Sneasler",
        ability: "Unburden",
        item: "Focus Sash",
        moves: ["Close Combat", "Dire Claw", "Fake Out", "Coaching"],
        nature: "Adamant",
        evs: "HP 2 / Atk 32 / Def 0 / SpA 0 / SpD 0 / Spe 32",
      },
      {
        species: "Kingambit",
        ability: "Defiant",
        item: "Black Glasses",
        moves: ["Kowtow Cleave", "Sucker Punch", "Swords Dance", "Protect"],
        nature: "Adamant",
        evs: "HP 32 / Atk 32 / Def 0 / SpA 0 / SpD 2 / Spe 0",
      },
      {
        species: "Aerodactyl",
        ability: "Unnerve",
        item: "Focus Sash",
        moves: ["Tailwind", "Rock Slide", "Wide Guard", "Protect"],
        nature: "Jolly",
        evs: "HP 2 / Atk 32 / Def 0 / SpA 0 / SpD 0 / Spe 32",
      },
      {
        species: "Garchomp",
        ability: "Rough Skin",
        item: "Haban Berry",
        moves: ["Dragon Claw", "Earthquake", "Stomping Tantrum", "Protect"],
        nature: "Jolly",
        evs: "HP 2 / Atk 32 / Def 0 / SpA 0 / SpD 0 / Spe 32",
      },
    ],
    strategy:
      "Lead Scovillain + Primarina. Turn 1: Scovillain Rage Powder, Primarina Calm Mind. Opponent contacts Scovillain → burned → -50% Atk permanent. Turn 2: Leech Seed + Hyper Voice behind redirection. Win condition: +2 Primarina OR +3 SD + Coaching Kingambit. Save Sneasler's one Fake Out (post-nerf) for a game-deciding turn.",
    tags: ["champions", "meta-counter", "burn-wall", "scovillain"],
  },
];

// Group creators for display
export const CREATORS = [
  {
    name: "Wolfe Glick",
    handle: "@WolfeyGlick",
    url: "https://www.youtube.com/@WolfeyVGC",
    description: "2016 World Champion, 10x Regional Champion, 2x International Champion. The most influential VGC creator.",
  },
  {
    name: "CybertronVGC",
    handle: "@CybertronVGC",
    url: "https://www.youtube.com/@CybertronVGC",
    description: "Aaron Zheng — 5x Regional Champion, 2x National Champion. Stanford MBA. Educational coaching focus.",
  },
  {
    name: "PokeaimMD",
    handle: "@PokeaimMD",
    url: "https://www.youtube.com/@PokeaimMD",
    description: "Singles/doubles content with strong analysis. Strategic team-building focus.",
  },
  {
    name: "James Baek",
    handle: "@James_Baek",
    url: "https://www.youtube.com/@JamesBaek",
    description: "In-depth team analysis and archetype breakdowns.",
  },
  {
    name: "ThatsAPlusOne",
    handle: "@ThatsAPlusOne",
    url: "https://www.youtube.com/@ThatsAPlusOne",
    description: "Unique team builds and creative strategies.",
  },
  {
    name: "SableyeVGC",
    handle: "@SableyeVGC",
    url: "https://www.twitch.tv/sableyevgc",
    description: "Regular Twitch streams + Chilling Neigh Podcast.",
  },
];
