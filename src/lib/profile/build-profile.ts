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
  classifyArchetypeFromSnapshot,
  membersFromSnapshot,
  isKnownArchetype,
} from "@/lib/team-analysis/team-context";
import {
  calculatePokemonUsage,
  calculateArchetypeMatchups,
  type PokemonUsageStat,
  type ArchetypeMatchup,
} from "@/lib/utils/stats";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

const toMembers = membersFromSnapshot;

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
  /** Your win-rate vs each OPPONENT archetype — where you're soft (auto-tagged). */
  opponentArchetypes: ArchetypeMatchup[];
  /** Pokémon opponents bring against you most, with your win-rate when faced. */
  mostFacedPokemon: PokemonUsageStat[];
}

/**
 * Your win-rate vs each opponent archetype, derived from match history. Opponent
 * archetypes are auto-classified on save (archetypeOpponent); for older rows
 * that predate tagging we classify on the fly from the brought species. Shared
 * by the profile view and the team-debate meta-analyst (your weak matchups).
 */
export async function getOpponentMatchups(
  userId: string = DEFAULT_USER_ID,
): Promise<ArchetypeMatchup[]> {
  const rows = await db
    .select({
      result: matches.result,
      format: matches.format,
      archetypeOpponent: matches.archetypeOpponent,
      opponentBrought: matches.opponentBrought,
    })
    .from(matches)
    .where(eq(matches.userId, userId))
    .all();

  return calculateArchetypeMatchups(
    rows.map((m) => ({
      result: m.result ?? "",
      archetypeOpponent: resolveOpponentArchetype(
        m.archetypeOpponent,
        m.opponentBrought,
        m.format,
      ),
    })),
  ).sort((a, b) => b.wins + b.losses - (a.wins + a.losses));
}

/** Trust a stored opponent archetype only when it's a recognized tag; else
 *  classify on the fly from the brought species (legacy/untagged rows). */
function resolveOpponentArchetype(
  stored: unknown,
  opponentBrought: unknown,
  format: string | null,
): string | undefined {
  if (isKnownArchetype(stored)) return stored;
  const arche = classifyArchetypeFromSnapshot(
    null,
    opponentBrought,
    format ?? ACTIVE_REGULATION_FORMAT_ID,
  );
  return arche && arche !== "Unknown" ? arche : undefined;
}

export async function buildPlayerProfile(
  userId: string = DEFAULT_USER_ID,
): Promise<PlayerProfile> {
  const teams = await getAllTeams(userId);
  const matchRows = await db
    .select({
      result: matches.result,
      teamId: matches.teamId,
      format: matches.format,
      myBrought: matches.myBrought,
      myLeads: matches.myLeads,
      archetypeOpponent: matches.archetypeOpponent,
      opponentBrought: matches.opponentBrought,
      opponentLeads: matches.opponentLeads,
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

  // Your win-rate vs each opponent archetype (auto-tag, with fly-classify
  // fallback for untagged rows) — where you're soft.
  const opponentArchetypes = calculateArchetypeMatchups(
    matchRows.map((m) => ({
      result: m.result ?? "",
      archetypeOpponent: resolveOpponentArchetype(
        m.archetypeOpponent,
        m.opponentBrought,
        m.format,
      ),
    })),
  ).sort((a, b) => b.wins + b.losses - (a.wins + a.losses));

  // Pokémon opponents bring most + your win-rate when facing them. Reuses the
  // usage aggregator: "brought"/"led" are the OPPONENT's, win-rate is YOURS.
  const mostFacedPokemon = calculatePokemonUsage(
    matchRows.map((m) => ({
      myBrought: asStringArray(m.opponentBrought),
      myLeads: asStringArray(m.opponentLeads),
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
    opponentArchetypes,
    mostFacedPokemon,
  };
}
