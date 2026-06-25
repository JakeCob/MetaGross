/**
 * Team defensive-coverage matrix: for each attacking type, how each team
 * member fares and how many are weak / resist / immune. Used by the team
 * builder's "Defensive coverage" table to surface shared weaknesses.
 *
 * Pure — no `@pkmn` import. The caller resolves species → types (server-side)
 * and hands the resolved members in.
 */
import { POKEMON_TYPES, typeMatchup } from "./type-chart";

export interface CoverageMember {
  species: string;
  types: string[];
  /** Optional — used for ability-based immunities/resists (Levitate, etc.). */
  ability?: string;
}

export interface MemberMatchup {
  species: string;
  types: string[];
  /** attackType → defensive multiplier (0 / 0.25 / 0.5 / 1 / 2 / 4). */
  multipliers: Record<string, number>;
}

export interface TypeRow {
  type: string;
  weak: number; // members taking > ×1
  resist: number; // members taking < ×1 but > 0
  immune: number; // members taking ×0
  neutral: number;
  /** weak − (resist + immune): positive means the team leans weak to this type. */
  net: number;
  /** ≥3 members weak — a shared weakness worth flagging. */
  shared: boolean;
  /** ≥3 weak AND nothing resists/is immune — an uncovered hole. */
  critical: boolean;
}

export interface TeamCoverage {
  members: MemberMatchup[];
  rows: TypeRow[];
  /** Attack types flagged `shared`, worst-first. */
  sharedWeaknesses: string[];
}

const SHARED_THRESHOLD = 3;

/** Build the defensive coverage matrix for a set of resolved team members. */
export function computeCoverage(members: CoverageMember[]): TeamCoverage {
  const valid = members.filter((m) => m.species && m.types.length > 0);

  const memberMatchups: MemberMatchup[] = valid.map((m) => {
    const multipliers: Record<string, number> = {};
    for (const t of POKEMON_TYPES) {
      multipliers[t] = typeMatchup(t, m.types, m.ability);
    }
    return { species: m.species, types: m.types, multipliers };
  });

  const rows: TypeRow[] = POKEMON_TYPES.map((type) => {
    let weak = 0, resist = 0, immune = 0, neutral = 0;
    for (const mm of memberMatchups) {
      const v = mm.multipliers[type];
      if (v === 0) immune++;
      else if (v > 1) weak++;
      else if (v < 1) resist++;
      else neutral++;
    }
    const net = weak - (resist + immune);
    const shared = weak >= SHARED_THRESHOLD;
    const critical = shared && resist + immune === 0;
    return { type, weak, resist, immune, neutral, net, shared, critical };
  });

  const sharedWeaknesses = rows
    .filter((r) => r.shared)
    .sort((a, b) => b.net - a.net || b.weak - a.weak)
    .map((r) => r.type);

  return { members: memberMatchups, rows, sharedWeaknesses };
}
