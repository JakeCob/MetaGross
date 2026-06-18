/**
 * Shared, deterministic team-building context + auditor.
 *
 * This module is the "skills" layer the team-building agents reason with: it
 * turns a (partial or full) team into a structured analysis — weather plan,
 * speed mode, mega count, shared defensive weaknesses — and runs a HARD-RULE
 * audit that catches the mistakes a one-shot LLM keeps making (a rain payoff
 * with no rain, Trick Room on a Tailwind team, two mega stones, an illegal
 * roster pick, an uncovered shared weakness).
 *
 * Deliberately PURE (no `server-only`, no network, no LLM) so it is unit-
 * testable and can be the deterministic gate for the multi-agent debate loop.
 * It uses @pkmn-backed helpers (types/species/champions) the same way the
 * other src/lib/pokemon utilities do.
 */
import {
  getRegulation,
  getMegaFormFor,
  getMegaAbility,
  isChampionsPokemon,
  isConfirmedNotInChampions,
} from "@/lib/data/champions";
import { getSpecies } from "@/lib/pokemon/species";
import { getTypeEffectiveness, getAllTypes } from "@/lib/pokemon/types";

/** A team member as the AI tools pass it around. Moves are optional because
 *  the suggester works from partial teams; the debate works from full sets. */
export interface AITeamMember {
  species: string;
  item?: string;
  ability?: string;
  moves?: string[];
}

const WEATHER_BY_ABILITY: Record<string, string> = {
  drizzle: "rain",
  drought: "sun",
  "sand stream": "sandstorm",
  "snow warning": "snow",
};
/** Moves that set weather, so a team without the ability can still have it. */
const WEATHER_BY_MOVE: Record<string, string> = {
  "rain dance": "rain",
  "sunny day": "sun",
  sandstorm: "sandstorm",
  "snowscape": "snow",
  hail: "snow",
  chillyreception: "snow",
  "chilly reception": "snow",
};
const FAST_ABILITIES = new Set([
  "swift swim",
  "chlorophyll",
  "sand rush",
  "slush rush",
  "unburden",
  "surge surfer",
]);
/** Speed ability ↔ the weather it needs to actually boost speed. */
const FAST_ABILITY_WEATHER: Record<string, string> = {
  "swift swim": "rain",
  chlorophyll: "sun",
  "sand rush": "sandstorm",
  "slush rush": "snow",
};
/** Moves whose payoff is gated on a weather (charge-skip / boost). */
const WEATHER_LOCKED_MOVES: Record<string, string> = {
  "electro shot": "rain", // 2-turn charge unless raining
  "solar beam": "sun",
  "solar blade": "sun",
};

/** Ability immunities / redirection that neutralise an attacking type. */
export const TYPE_IMMUNITY_ABILITIES: Record<string, string> = {
  Electric:
    "Lightning Rod / Volt Absorb / Motor Drive — Lightning Rod also REDIRECTS Electric off your weak member",
  Water: "Storm Drain / Water Absorb / Dry Skin — Storm Drain REDIRECTS Water",
  Fire: "Flash Fire / Thick Fat",
  Ground: "Levitate / Earth Eater",
  Grass: "Sap Sipper",
  Ice: "Thick Fat",
};

function norm(s: string | undefined | null): string {
  return (s ?? "").toLowerCase().trim();
}

function memberMoves(m: AITeamMember): string[] {
  return (m.moves ?? []).map(norm).filter(Boolean);
}

/** Resolve a member to its effective species (mega form when it megas). */
function resolveSpecies(m: AITeamMember, format: string) {
  const megaName = getMegaFormFor(m.species, m.item, format);
  return (megaName && getSpecies(megaName)) || getSpecies(m.species);
}

/** Resolved typing for a member, using the mega form's typing when it megas. */
function memberTypes(m: AITeamMember, format: string): string[] {
  return resolveSpecies(m, format)?.types ?? [];
}

export interface WeaknessEntry {
  /** Attacking type that threatens 2+ members. */
  type: string;
  /** Members it hits super-effectively. */
  members: string[];
  /** Members it hits 4×. */
  quad: string[];
  /** Members that RESIST or are immune (typing only — ability immunities are
   *  recommended separately). */
  resisted: string[];
}

export interface MemberProfile {
  name: string;
  types: string[];
  /** Base Speed of the effective (mega) form — what Trick Room cares about. */
  baseSpeed: number;
}

export interface TeamAnalysis {
  format: string;
  /** Weather this team actually sets (from an ability or a move), or null. */
  weather: string | null;
  hasTrickRoom: boolean;
  hasTailwind: boolean;
  /** Weather-speed abilities present (swift swim etc.). */
  fastAbilities: string[];
  /** Count of members holding a mega stone (legal Champions max = 1). */
  megaCount: number;
  /** Per-member typing + base Speed (mega-aware). */
  members: MemberProfile[];
  /** Shared defensive weaknesses (attacking types hitting 2+ members SE). */
  weaknesses: WeaknessEntry[];
}

/** Structured analysis of a (partial or full) team. */
export function analyzeTeam(
  team: AITeamMember[],
  format: string,
): TeamAnalysis {
  const abilities = team.map((m) => norm(m.ability));
  const allMoves = team.flatMap(memberMoves);

  const weatherFromAbility = abilities
    .map((a) => WEATHER_BY_ABILITY[a])
    .find(Boolean);
  const weatherFromMove = allMoves.map((mv) => WEATHER_BY_MOVE[mv]).find(Boolean);
  const weather = weatherFromAbility ?? weatherFromMove ?? null;

  const fastAbilities = abilities.filter((a) => FAST_ABILITIES.has(a));

  let megaCount = 0;
  for (const m of team) {
    if (getMegaFormFor(m.species, m.item, format)) megaCount += 1;
  }

  // Per-member typing + base Speed (mega-aware).
  const members: MemberProfile[] = team
    .map((m) => {
      const sp = resolveSpecies(m, format);
      return sp
        ? { name: m.species, types: sp.types, baseSpeed: sp.baseStats.spe }
        : null;
    })
    .filter((p): p is MemberProfile => p !== null);

  // Defensive weakness profile across members with known typing.
  const profiles = members.filter((p) => p.types.length > 0);

  const weaknesses: WeaknessEntry[] = [];
  if (profiles.length >= 2) {
    for (const atk of getAllTypes()) {
      const members: string[] = [];
      const quad: string[] = [];
      const resisted: string[] = [];
      for (const p of profiles) {
        const eff = getTypeEffectiveness(atk, p.types);
        if (eff >= 2) {
          members.push(p.name);
          if (eff >= 4) quad.push(p.name);
        } else if (eff < 1) {
          resisted.push(p.name);
        }
      }
      if (members.length >= 2) {
        weaknesses.push({ type: atk, members, quad, resisted });
      }
    }
    weaknesses.sort((a, b) => b.members.length - a.members.length);
  }

  return {
    format,
    weather,
    hasTrickRoom: allMoves.includes("trick room"),
    hasTailwind: allMoves.includes("tailwind"),
    fastAbilities,
    megaCount,
    members,
    weaknesses,
  };
}

/**
 * Human-readable summary of the core's shared defensive weaknesses, for
 * prompting. Empty string when nothing is shared by 2+ members.
 */
export function computeCoreWeaknesses(
  team: AITeamMember[],
  format: string,
): string {
  const { weaknesses } = analyzeTeam(team, format);
  if (weaknesses.length === 0) return "";
  return weaknesses
    .map((w) => {
      const quad = w.quad.length ? ` [4× on ${w.quad.join(", ")}]` : "";
      const cover = TYPE_IMMUNITY_ABILITIES[w.type];
      // Whether a teammate already resists it (the type-backbone signal).
      const covered = w.resisted.length
        ? `resisted by ${w.resisted.join(", ")}`
        : `NOT resisted by anyone — uncovered`;
      const fix = cover ? `; ideal: immunity ability (${cover})` : "";
      return `${w.type} → threatens ${w.members.join(", ")}${quad}; ${covered}${fix}`;
    })
    .join("\n");
}

/** Per-member base Speed list — the data a Trick Room / fast plan turns on. */
export function formatSpeedProfile(
  team: AITeamMember[],
  format: string,
): string {
  const { members } = analyzeTeam(team, format);
  if (!members.length) return "";
  return members
    .map((m) => `${m.name} ${m.baseSpeed} Spe (${m.types.join("/")})`)
    .join(", ");
}

/**
 * A hard speed-plan directive: don't add a contradictory speed mode (the
 * classic mistake — a Trick Room setter on a fast rain / Tailwind team).
 */
export function detectSpeedDirective(team: AITeamMember[], format: string): string {
  const a = analyzeTeam(team, format);
  // A "fast / outspeed" plan needs an actual speed booster — a weather-speed
  // ability (Swift Swim, Chlorophyll…) or Tailwind. BARE weather is not a speed
  // plan: Drought sun on a slow Trick Room team is a damage weather, not speed.
  const fast = a.fastAbilities.length > 0 || a.hasTailwind;
  if (a.hasTrickRoom && !fast) {
    return `SPEED PLAN: this is a TRICK ROOM team — under TR the SLOWEST Pokemon moves first, so every attacker should have LOW base Speed (aim ≤ ~60; never add a base-Speed ≥ 95 attacker). Pick slow, bulky breakers (e.g. Kingambit 50, Sylveon 60, Torkoal 20, Mawile 50). Do NOT add Tailwind, Swift Swim or other speed-boosters — they fight Trick Room.`;
  }
  if (fast && !a.hasTrickRoom) {
    const plan = a.weather ? `${a.weather} ` : "fast ";
    const via = a.fastAbilities.length ? "weather-speed abilities + Tailwind" : "Tailwind";
    return `SPEED PLAN: this is a ${plan}offensive team — it WINS BY OUTSPEEDING (${via}). Use TAILWIND for speed control. Do NOT suggest any Trick Room setter or a slow Trick Room attacker — Trick Room inverts speed and would sabotage this team.`;
  }
  return "";
}

/**
 * Weather directive: weather-locked payoffs are traps without their enabler on
 * the team. If no weather is set, hard-warn against rain/sun/sand/snow-locked
 * picks (esp. Archaludon's Electro Shot, a 2-turn charge unless raining).
 */
export function detectWeatherDirective(
  team: AITeamMember[],
  format: string,
): string {
  const { weather } = analyzeTeam(team, format);
  if (weather) {
    return `WEATHER PLAN: this team sets ${weather}. Weather-locked payoffs are valid ONLY if they use ${weather} — do NOT suggest a pick that needs a DIFFERENT weather.`;
  }
  return `NO WEATHER ON THIS TEAM: no member sets rain / sun / sand / snow. Do NOT suggest a Pokemon whose payoff REQUIRES a weather this team lacks — especially Archaludon (Electro Shot is a 2-turn charge move unless it is raining), Swift Swim / Chlorophyll / Sand Rush / Slush Rush sweepers, or Solar Beam / Solar Power sun abusers. Only suggest such a pick if you ALSO add the weather setter that enables it.`;
}

// ---------------------------------------------------------------------------
// Deterministic auditor — the critic agent's reliable backbone.
// ---------------------------------------------------------------------------

export type ViolationSeverity = "error" | "warning";

export interface TeamViolation {
  rule: string;
  severity: ViolationSeverity;
  message: string;
  /** Species this violation is about, when applicable. */
  subject?: string;
}

/**
 * Audit a team against hard VGC / Champions rules. `error`s are things a good
 * team must not ship (illegal pick, two megas, weather trap, speed clash);
 * `warning`s are strong smells (uncovered shared weakness). The debate loop
 * keeps revising while any `error` remains.
 */
export function auditTeam(
  team: AITeamMember[],
  format: string,
): TeamViolation[] {
  const out: TeamViolation[] = [];
  if (team.length === 0) return out;

  const analysis = analyzeTeam(team, format);

  // 1. Roster legality.
  for (const m of team) {
    if (!m.species) continue;
    if (
      !isChampionsPokemon(m.species, format) ||
      isConfirmedNotInChampions(m.species, format)
    ) {
      out.push({
        rule: "roster",
        severity: "error",
        subject: m.species,
        message: `${m.species} is not legal in ${getRegulation(format).label}.`,
      });
    }
  }

  // 2. Species clause — no duplicates.
  const seen = new Map<string, number>();
  for (const m of team) {
    const k = norm(m.species);
    if (!k) continue;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  for (const [k, n] of seen) {
    if (n > 1) {
      out.push({
        rule: "species-clause",
        severity: "error",
        subject: k,
        message: `${k} appears ${n} times — only one of each species is allowed.`,
      });
    }
  }

  // 3. Mega clause — at most one mega stone on the team.
  if (analysis.megaCount > 1) {
    const stones = team
      .filter((m) => getMegaFormFor(m.species, m.item, format))
      .map((m) => `${m.species} @ ${m.item}`);
    out.push({
      rule: "mega-clause",
      severity: "error",
      message: `Two mega stones on the team (${stones.join(", ")}). Champions allows only one Mega per team.`,
    });
  }

  // 4. Speed identity clash — Trick Room AND an actual speed booster (a
  //    weather-speed ability or Tailwind). Bare weather (e.g. Drought sun for
  //    damage on a TR team) is NOT a clash.
  const fastPlan =
    analysis.fastAbilities.length > 0 || analysis.hasTailwind;
  if (analysis.hasTrickRoom && fastPlan) {
    const why = [
      analysis.hasTailwind ? "Tailwind" : "",
      analysis.fastAbilities.length ? `${analysis.fastAbilities.join("/")}` : "",
    ]
      .filter(Boolean)
      .join(" + ");
    out.push({
      rule: "speed-identity",
      severity: "error",
      message: `Trick Room is on a team that also runs ${why}. Trick Room inverts speed and cancels a fast/Tailwind plan — pick one speed mode.`,
    });
  }

  // 5. Weather-locked traps — a payoff that needs a weather the team lacks.
  for (const m of team) {
    const moves = memberMoves(m);
    const ability = norm(m.ability);
    // Move-gated payoffs (Electro Shot / Solar Beam ...).
    for (const mv of moves) {
      const need = WEATHER_LOCKED_MOVES[mv];
      if (need && analysis.weather !== need) {
        out.push({
          rule: "weather-trap",
          severity: "error",
          subject: m.species,
          message: `${m.species}'s ${mv} needs ${need} to skip its charge turn, but the team has no ${need} source — it will charge a turn and get punished.`,
        });
      }
    }
    // Ability-gated speed (Swift Swim etc.) with no matching weather.
    const need = FAST_ABILITY_WEATHER[ability];
    if (need && analysis.weather !== need) {
      out.push({
        rule: "weather-trap",
        severity: "warning",
        subject: m.species,
        message: `${m.species}'s ${ability} only boosts speed in ${need}, which this team doesn't set.`,
      });
    }
  }

  // 6. Trick Room speed fit — under TR the slowest moves first, so attackers
  //    should be slow. Flag fast Pokemon on a committed TR team.
  if (analysis.hasTrickRoom && !fastPlan) {
    for (const mem of analysis.members) {
      if (mem.baseSpeed >= 95) {
        out.push({
          rule: "tr-speed",
          severity: "error",
          subject: mem.name,
          message: `${mem.name} has base Speed ${mem.baseSpeed} — far too fast for a Trick Room team (TR makes the SLOWEST Pokemon move first). Replace it with a slow attacker (base Speed ≤ ~60).`,
        });
      } else if (mem.baseSpeed >= 75) {
        out.push({
          rule: "tr-speed",
          severity: "warning",
          subject: mem.name,
          message: `${mem.name} (base Speed ${mem.baseSpeed}) is on the fast side for Trick Room — acceptable as a defensive answer, but most TR attackers want base Speed ≤ ~60.`,
        });
      }
    }
  }

  // 7. Uncovered shared weakness — a type hits 3+ members SE and NObody on the
  //    team resists/is immune to it (purely typing-based — abilities may still
  //    help, hence a warning not an error).
  for (const w of analysis.weaknesses) {
    if (w.members.length >= 3 && w.resisted.length === 0) {
      out.push({
        rule: "open-weakness",
        severity: "warning",
        message: `${w.type} threatens ${w.members.length} members (${w.members.join(", ")}) and nothing on the team resists it — add a ${w.type}-resist or an immunity ability.`,
      });
    }
  }

  return out;
}

/** Convenience: just the blocking errors. */
export function teamErrors(team: AITeamMember[], format: string): TeamViolation[] {
  return auditTeam(team, format).filter((v) => v.severity === "error");
}

/**
 * The ability a member ACTUALLY has, mega-aware. Resolution order:
 *   1. CHAMPIONS_MEGA_ABILITIES override — for invented Z-A megas where the dex
 *      returns the wrong (base) ability (Staraptor-Mega → Contrary).
 *   2. @pkmn's mega-form ability — for REAL Gen-6 megas the dex knows correctly
 *      (Mawile-Mega → Huge Power, Charizard-Mega-Y → Drought).
 *   3. The member's own set ability (no mega, or unknown form).
 *
 * Server-side only path (uses @pkmn via getSpecies) — that's why it lives here
 * and not in the client-imported champions.ts.
 */
export function megaAbilityFor(
  m: AITeamMember,
  format: string,
): string | null {
  const mega = getMegaFormFor(m.species, m.item, format);
  if (!mega) return m.ability ?? null;
  return (
    getMegaAbility(mega) ??
    resolveSpecies(m, format)?.abilities?.[0] ??
    m.ability ??
    null
  );
}

/** Return the team with each mega member's ability corrected to its real
 *  post-mega ability (Mega Mawile → Huge Power). Non-mega members unchanged. */
export function withMegaAbilities<T extends AITeamMember>(
  team: T[],
  format: string,
): T[] {
  return team.map((m) =>
    getMegaFormFor(m.species, m.item, format)
      ? { ...m, ability: megaAbilityFor(m, format) ?? m.ability }
      : m,
  );
}

/** Mega-aware ability label for prompts/transcripts. */
export function describeMember(m: AITeamMember, format: string): string {
  const mega = getMegaFormFor(m.species, m.item, format);
  const ability = megaAbilityFor(m, format) || m.ability;
  const head = m.item ? `${m.species} @ ${m.item}` : m.species;
  const tags: string[] = [];
  if (mega) tags.push(`Mega → ${mega}`);
  if (ability) tags.push(`ability: ${ability}`);
  const moves = memberMoves(m);
  if (moves.length) tags.push(`moves: ${(m.moves ?? []).filter(Boolean).join("/")}`);
  return tags.length ? `${head} (${tags.join(", ")})` : head;
}
