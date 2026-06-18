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

/** Resolved typing for a member, using the mega form's typing when it megas. */
function memberTypes(m: AITeamMember, format: string): string[] {
  const megaName = getMegaFormFor(m.species, m.item, format);
  const sp = (megaName && getSpecies(megaName)) || getSpecies(m.species);
  return sp ? sp.types : [];
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

  // Defensive weakness profile across members with known typing.
  const profiles = team
    .map((m) => ({ name: m.species, types: memberTypes(m, format) }))
    .filter((p) => p.types.length > 0);

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
      return `${w.type} → threatens ${w.members.join(", ")}${quad}${cover ? `; best answer = immunity ability (${cover})` : "; cover with a resist/answer"}`;
    })
    .join("\n");
}

/**
 * A hard speed-plan directive: don't add a contradictory speed mode (the
 * classic mistake — a Trick Room setter on a fast rain / Tailwind team).
 */
export function detectSpeedDirective(team: AITeamMember[], format: string): string {
  const a = analyzeTeam(team, format);
  const fast = a.weather || a.fastAbilities.length > 0 || a.hasTailwind;
  if (a.hasTrickRoom && !fast) {
    return `SPEED PLAN: this is a TRICK ROOM team — it WINS BY GOING SLOW. Suggest slow, bulky attackers. Do NOT add Tailwind, Swift Swim or other speed-boosters — they fight Trick Room.`;
  }
  if (fast) {
    const plan = a.weather ? `${a.weather} weather` : "fast offensive";
    return `SPEED PLAN: this is a ${plan} team — it WINS BY OUTSPEEDING (weather/Tailwind). Use TAILWIND for speed control. Do NOT suggest any Trick Room setter or a slow Trick Room attacker — Trick Room inverts speed and would sabotage this team.`;
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

  // 4. Speed identity clash — Trick Room AND a fast/weather/Tailwind plan.
  const fastPlan =
    analysis.weather || analysis.fastAbilities.length > 0 || analysis.hasTailwind;
  if (analysis.hasTrickRoom && fastPlan) {
    const why = [
      analysis.hasTailwind ? "Tailwind" : "",
      analysis.fastAbilities.length ? `${analysis.fastAbilities.join("/")}` : "",
      analysis.weather ? `${analysis.weather} (speed weather)` : "",
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

  // 6. Uncovered shared weakness — a type hits 3+ members SE and NObody on the
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

/** Mega-aware ability label for prompts/transcripts. */
export function describeMember(m: AITeamMember, format: string): string {
  const mega = getMegaFormFor(m.species, m.item, format);
  const ability = (mega && getMegaAbility(mega)) || m.ability;
  const head = m.item ? `${m.species} @ ${m.item}` : m.species;
  const tags: string[] = [];
  if (mega) tags.push(`Mega → ${mega}`);
  if (ability) tags.push(`ability: ${ability}`);
  const moves = memberMoves(m);
  if (moves.length) tags.push(`moves: ${(m.moves ?? []).filter(Boolean).join("/")}`);
  return tags.length ? `${head} (${tags.join(", ")})` : head;
}
