/**
 * Player profile aggregation — strengths/weaknesses + preferred archetypes,
 * derived from saved teams + match history. Archetypes are CLASSIFIED from team
 * composition (classifyArchetype) so this works without manual tags (which the
 * data doesn't capture). Grows richer as more matches are logged.
 */
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAllTeams } from "@/lib/db/queries/teams";
import {
  classifyArchetype,
  type AITeamMember,
} from "@/lib/team-analysis/team-context";
import { calculatePokemonUsage, type PokemonUsageStat } from "@/lib/utils/stats";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

function toMembers(pokemon: unknown): AITeamMember[] {
  if (!Array.isArray(pokemon)) return [];
  return pokemon
    .map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      const moves = Array.isArray(o.moves)
        ? (o.moves as unknown[]).filter((x): x is string => typeof x === "string")
        : undefined;
      return {
        species: typeof o.species === "string" ? o.species : "",
        ability: typeof o.ability === "string" ? o.ability : undefined,
        item: typeof o.item === "string" ? o.item : undefined,
        moves,
      };
    })
    .filter((m) => m.species);
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export interface ArchetypeRecord {
  archetype: string;
  wins: number;
  losses: number;
  winRate: number;
  matches: number;
}

export interface PreferredArchetype {
  archetype: string;
  teams: number;
  matches: number;
}

export interface PlayerProfile {
  matchCount: number;
  teamCount: number;
  record: { wins: number; losses: number; total: number; winRate: number };
  streak: { type: "win" | "loss"; count: number } | null;
  /** Archetypes you build/play most (from saved teams + matches). */
  preferredArchetypes: PreferredArchetype[];
  /** Win-rate when YOU play each archetype — your strengths/weaknesses. */
  archetypeStrengths: ArchetypeRecord[];
  mostUsedPokemon: PokemonUsageStat[];
}

export async function buildPlayerProfile(
  userId: string = DEFAULT_USER_ID,
): Promise<PlayerProfile> {
  const teams = await getAllTeams(userId);
  const matchRows = await db
    .select({
      result: matches.result,
      teamId: matches.teamId,
      myBrought: matches.myBrought,
      myLeads: matches.myLeads,
    })
    .from(matches)
    .where(eq(matches.userId, userId))
    .orderBy(desc(matches.playedAt))
    .all();

  // Classify each saved team's archetype.
  const teamArchetype = new Map<string, string>();
  const archetypeTeamCount = new Map<string, number>();
  for (const t of teams) {
    const arche = classifyArchetype(
      toMembers(t.pokemon),
      t.format ?? ACTIVE_REGULATION_FORMAT_ID,
    );
    teamArchetype.set(t.id, arche);
    archetypeTeamCount.set(arche, (archetypeTeamCount.get(arche) ?? 0) + 1);
  }

  // Record.
  const wins = matchRows.filter((m) => m.result === "win").length;
  const losses = matchRows.filter((m) => m.result === "loss").length;
  const total = wins + losses;
  const record = {
    wins,
    losses,
    total,
    winRate: total > 0 ? Math.round((wins / total) * 1000) / 10 : 0,
  };

  // Current streak (matchRows are newest-first).
  let streak: PlayerProfile["streak"] = null;
  const firstDecisive = matchRows.find(
    (m) => m.result === "win" || m.result === "loss",
  )?.result;
  if (firstDecisive === "win" || firstDecisive === "loss") {
    let count = 0;
    for (const m of matchRows) {
      if (m.result === firstDecisive) count++;
      else if (m.result === "win" || m.result === "loss") break;
    }
    streak = { type: firstDecisive, count };
  }

  // Win-rate by MY archetype (match.teamId → that team's classified archetype).
  const buckets = new Map<string, { wins: number; losses: number; matches: number }>();
  for (const m of matchRows) {
    const arche = m.teamId ? teamArchetype.get(m.teamId) : undefined;
    if (!arche) continue;
    const b = buckets.get(arche) ?? { wins: 0, losses: 0, matches: 0 };
    b.matches++;
    if (m.result === "win") b.wins++;
    else if (m.result === "loss") b.losses++;
    buckets.set(arche, b);
  }
  const archetypeStrengths: ArchetypeRecord[] = [...buckets.entries()]
    .map(([archetype, b]) => {
      const t = b.wins + b.losses;
      return {
        archetype,
        wins: b.wins,
        losses: b.losses,
        winRate: t > 0 ? Math.round((b.wins / t) * 1000) / 10 : 0,
        matches: b.matches,
      };
    })
    .sort((a, b) => b.matches - a.matches);

  // Preferred archetypes (saved teams + matches played with each).
  const preferredArchetypes: PreferredArchetype[] = [
    ...archetypeTeamCount.entries(),
  ]
    .map(([archetype, teamsN]) => ({
      archetype,
      teams: teamsN,
      matches: buckets.get(archetype)?.matches ?? 0,
    }))
    .sort((a, b) => b.teams + b.matches - (a.teams + a.matches));

  const mostUsedPokemon = calculatePokemonUsage(
    matchRows.map((m) => ({
      myBrought: asStringArray(m.myBrought),
      myLeads: asStringArray(m.myLeads),
      result: m.result ?? "",
    })),
  ).slice(0, 10);

  return {
    matchCount: matchRows.length,
    teamCount: teams.length,
    record,
    streak,
    preferredArchetypes,
    archetypeStrengths,
    mostUsedPokemon,
  };
}
