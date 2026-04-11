/**
 * Team suggestion engine — pure heuristic analysis.
 *
 * Generates team-building suggestions based on:
 * 1. Teammate synergy from Pikalytics meta data
 * 2. Type coverage gaps
 * 3. Team role checking (Fake Out, speed control, redirect, Intimidate)
 * 4. Meta staples that complement the team
 *
 * Works WITHOUT any AI API key — all logic is deterministic.
 */
import "server-only";

import { getSpecies } from "@/lib/pokemon/species";
import { getTypeEffectiveness, getAllTypes } from "@/lib/pokemon/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TeamSuggestion {
  species: string;
  reason: string;
  category: "coverage" | "synergy" | "role" | "meta";
  priority: number; // higher = better suggestion
}

export interface MetaEntry {
  species: string;
  usage?: number;
  teammates: { name: string; usage: number }[];
}

// ---------------------------------------------------------------------------
// Role definitions
// ---------------------------------------------------------------------------

interface RoleDef {
  label: string;
  pokemon: string[];
  description: string;
}

const TEAM_ROLES: Record<string, RoleDef> = {
  fakeOut: {
    label: "Fake Out support",
    pokemon: [
      "Incineroar", "Sneasler", "Rillaboom", "Kangaskhan",
      "Hitmontop", "Mienshao", "Scrafty", "Ludicolo",
    ],
    description: "disrupts leads with Fake Out pressure",
  },
  speedControl: {
    label: "Speed control",
    pokemon: [
      "Tornadus", "Whimsicott", "Talonflame", "Suicune",
      "Murkrow", "Aerodactyl", "Kilowattrel",
    ],
    description: "provides Tailwind for speed advantage",
  },
  trickRoom: {
    label: "Trick Room",
    pokemon: [
      "Sinistcha", "Farigiraf", "Porygon2", "Dusclops",
      "Hatterene", "Cresselia", "Oranguru", "Gothitelle",
    ],
    description: "sets Trick Room for slow attackers",
  },
  redirect: {
    label: "Redirect / Follow Me",
    pokemon: [
      "Amoonguss", "Indeedee", "Indeedee-F", "Clefairy",
      "Togekiss", "Pachirisu", "Lucario",
    ],
    description: "redirects attacks to protect teammates",
  },
  intimidate: {
    label: "Intimidate",
    pokemon: [
      "Incineroar", "Arcanine", "Gyarados", "Landorus",
      "Landorus-Therian", "Salamence", "Hitmontop", "Krookodile",
    ],
    description: "lowers opponents' Attack on switch-in",
  },
  weather: {
    label: "Weather setter",
    pokemon: [
      "Pelipper", "Torkoal", "Tyranitar", "Hippowdon",
      "Ninetales", "Ninetales-Alola", "Politoed", "Abomasnow",
    ],
    description: "sets weather to enable weather-dependent strategies",
  },
};

// ---------------------------------------------------------------------------
// Type chart helpers
// ---------------------------------------------------------------------------

/**
 * Get the defensive type weaknesses for a set of types.
 * Returns an array of types that deal super-effective (2x+) damage.
 */
function getWeaknesses(types: string[]): string[] {
  const allTypeNames = getAllTypes();
  const weak: string[] = [];
  for (const atk of allTypeNames) {
    const mult = getTypeEffectiveness(atk, types);
    if (mult >= 2) weak.push(atk);
  }
  return weak;
}

/**
 * Get the defensive type resistances + immunities for a set of types.
 */
function getResistances(types: string[]): string[] {
  const allTypeNames = getAllTypes();
  const resist: string[] = [];
  for (const atk of allTypeNames) {
    const mult = getTypeEffectiveness(atk, types);
    if (mult < 1) resist.push(atk);
  }
  return resist;
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

/**
 * Generate team suggestions based on the current team composition + meta data.
 *
 * @param currentTeam - Species names of filled team slots
 * @param metaData    - Per-Pokemon meta data with teammate usage info
 * @returns Sorted array of suggestions (highest priority first)
 */
export function generateTeamSuggestions(
  currentTeam: string[],
  metaData: MetaEntry[],
): TeamSuggestion[] {
  if (currentTeam.length === 0) return [];

  const suggestions: TeamSuggestion[] = [];
  const teamSet = new Set(currentTeam.map((s) => s.toLowerCase()));

  // Resolve species type data for the current team
  const teamTypeData: { species: string; types: string[] }[] = [];
  for (const species of currentTeam) {
    const data = getSpecies(species);
    if (data) {
      teamTypeData.push({ species, types: data.types });
    }
  }

  // Build a set of all species already suggested to avoid duplicates
  const alreadySuggested = new Set<string>();

  function addSuggestion(s: TeamSuggestion) {
    const key = s.species.toLowerCase();
    if (teamSet.has(key)) return; // skip if already on team
    if (alreadySuggested.has(key)) {
      // Boost priority of existing suggestion if this reason is better
      const existing = suggestions.find(
        (x) => x.species.toLowerCase() === key,
      );
      if (existing && s.priority > existing.priority) {
        existing.priority = s.priority;
        existing.reason = s.reason;
        existing.category = s.category;
      }
      return;
    }
    alreadySuggested.add(key);
    suggestions.push(s);
  }

  // -----------------------------------------------------------------------
  // 1. Teammate synergy — from Pikalytics usage data
  // -----------------------------------------------------------------------
  const teammateCounts = new Map<string, { count: number; totalUsage: number }>();

  for (const species of currentTeam) {
    const entry = metaData.find(
      (e) => e.species.toLowerCase() === species.toLowerCase(),
    );
    if (!entry) continue;

    for (const tm of entry.teammates) {
      if (teamSet.has(tm.name.toLowerCase())) continue;
      const key = tm.name.toLowerCase();
      const existing = teammateCounts.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalUsage += tm.usage;
      } else {
        teammateCounts.set(key, { count: 1, totalUsage: tm.usage });
      }
    }
  }

  // Sort by count first (shared teammate for multiple mons), then by usage
  const sortedTeammates = [...teammateCounts.entries()].sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    return b[1].totalUsage - a[1].totalUsage;
  });

  for (const [species, data] of sortedTeammates.slice(0, 6)) {
    // Resolve display name (proper casing) from meta data
    const metaEntry = metaData.find(
      (e) => e.species.toLowerCase() === species,
    );
    const displayName = metaEntry?.species ?? species;

    const priority = Math.min(100, data.count * 25 + Math.round(data.totalUsage / 5));
    const countLabel =
      data.count > 1
        ? `Top teammate for ${data.count} of your Pokemon`
        : `Frequently paired in the meta`;

    addSuggestion({
      species: displayName,
      reason: countLabel,
      category: "synergy",
      priority,
    });
  }

  // -----------------------------------------------------------------------
  // 2. Coverage gaps — shared type weaknesses
  // -----------------------------------------------------------------------
  if (teamTypeData.length >= 2) {
    const weaknessCounts = new Map<string, number>();
    for (const { types } of teamTypeData) {
      for (const w of getWeaknesses(types)) {
        weaknessCounts.set(w, (weaknessCounts.get(w) ?? 0) + 1);
      }
    }

    // Find types that hit 3+ team members super effectively
    const criticalWeaknesses = [...weaknessCounts.entries()]
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1]);

    for (const [weakType, count] of criticalWeaknesses.slice(0, 3)) {
      // Find meta Pokemon that resist this type and aren't already on the team
      for (const entry of metaData.slice(0, 30)) {
        if (teamSet.has(entry.species.toLowerCase())) continue;
        const speciesData = getSpecies(entry.species);
        if (!speciesData) continue;

        const resists = getResistances(speciesData.types);
        if (resists.includes(weakType)) {
          addSuggestion({
            species: entry.species,
            reason: `Covers your ${weakType} weakness (${count} members weak)`,
            category: "coverage",
            priority: 60 + count * 10,
          });
          break; // one suggestion per weakness type
        }
      }
    }

    // Also check for 2-member weaknesses if team is small
    if (currentTeam.length <= 3) {
      const moderateWeaknesses = [...weaknessCounts.entries()]
        .filter(([, count]) => count === 2)
        .sort((a, b) => b[1] - a[1]);

      for (const [weakType] of moderateWeaknesses.slice(0, 2)) {
        for (const entry of metaData.slice(0, 30)) {
          if (teamSet.has(entry.species.toLowerCase())) continue;
          if (alreadySuggested.has(entry.species.toLowerCase())) continue;
          const speciesData = getSpecies(entry.species);
          if (!speciesData) continue;

          const resists = getResistances(speciesData.types);
          if (resists.includes(weakType)) {
            addSuggestion({
              species: entry.species,
              reason: `Helps cover ${weakType} weakness`,
              category: "coverage",
              priority: 45,
            });
            break;
          }
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // 3. Role checking
  // -----------------------------------------------------------------------
  for (const [roleKey, roleDef] of Object.entries(TEAM_ROLES)) {
    const hasRole = currentTeam.some((species) =>
      roleDef.pokemon.some(
        (p) => p.toLowerCase() === species.toLowerCase(),
      ),
    );

    if (!hasRole) {
      // Skip weather role check unless the team is 4+ — weather is optional
      if (roleKey === "weather" && currentTeam.length < 4) continue;
      // Skip trick room — it's a team archetype, not a universal role
      if (roleKey === "trickRoom") continue;

      // Find the best meta-viable option for this role
      for (const candidate of roleDef.pokemon) {
        if (teamSet.has(candidate.toLowerCase())) continue;
        // Check if this Pokemon is in the meta (top 50)
        const inMeta = metaData.some(
          (e) => e.species.toLowerCase() === candidate.toLowerCase(),
        );

        if (inMeta) {
          addSuggestion({
            species: candidate,
            reason: `Your team lacks ${roleDef.label} — ${roleDef.description}`,
            category: "role",
            priority: roleKey === "fakeOut" || roleKey === "speedControl" ? 70 : 55,
          });
          break;
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // 4. Meta staples
  // -----------------------------------------------------------------------
  const topMeta = metaData.slice(0, 10);
  for (const entry of topMeta) {
    if (teamSet.has(entry.species.toLowerCase())) continue;
    if (alreadySuggested.has(entry.species.toLowerCase())) continue;

    const usageLabel = entry.usage
      ? `${entry.usage.toFixed(1)}% usage`
      : "top meta pick";

    addSuggestion({
      species: entry.species,
      reason: `Meta staple — ${usageLabel}`,
      category: "meta",
      priority: 30 + (entry.usage ?? 0) / 2,
    });
  }

  // Sort by priority descending, cap at 8 suggestions
  suggestions.sort((a, b) => b.priority - a.priority);
  return suggestions.slice(0, 8);
}
