/**
 * Limitless tournament-decklist aggregator.
 *
 * Pulls top-cut standings (with full 6-mon decklists) from every
 * recent Champions Reg M-A tournament on LimitlessVGC and upserts
 * each team into meta_teams. Much higher trust than Pikalytics
 * featured teams because it's verified tournament data, not
 * Showdown ladder snapshots.
 *
 * SERVER-ONLY.
 */
import "server-only";

import {
  getChampionsTournaments,
  getTournamentStandings,
  type LimitlessTournament,
} from "@/lib/pokemon/limitless";
import { upsertMetaTeam } from "./queries";

export interface AggregateLimitlessOptions {
  /** How many recent tournaments to walk. Default 25 (~2 months). */
  topTournaments?: number;
  /** How many top placements per tournament to record. Default 16. */
  topCut?: number;
  /** Minimum tournament size — skip 4-player showmatches. Default 16. */
  minPlayers?: number;
  /** Internal format id stored on the row. */
  internalFormat?: string;
  onProgress?: (event: {
    tournament: string;
    index: number;
    total: number;
    teamsFound: number;
  }) => void;
}

export interface AggregateLimitlessResult {
  tournamentsScanned: number;
  tournamentsSkipped: number;
  standingsConsidered: number;
  teamsInserted: number;
  teamsUpdated: number;
  errors: Array<{ tournament: string; error: string }>;
}

export async function aggregateFromLimitless(
  opts: AggregateLimitlessOptions = {},
): Promise<AggregateLimitlessResult> {
  const topTournaments = opts.topTournaments ?? 25;
  const topCut = opts.topCut ?? 16;
  const minPlayers = opts.minPlayers ?? 16;
  const internalFormat = opts.internalFormat ?? "champions-reg-m-a";

  const result: AggregateLimitlessResult = {
    tournamentsScanned: 0,
    tournamentsSkipped: 0,
    standingsConsidered: 0,
    teamsInserted: 0,
    teamsUpdated: 0,
    errors: [],
  };

  const tournaments = await getChampionsTournaments();
  if (tournaments.length === 0) {
    result.errors.push({
      tournament: "<list>",
      error: "no tournaments available from Limitless",
    });
    return result;
  }

  const walked = tournaments.slice(0, topTournaments);
  const fingerprintsSeenThisRun = new Set<string>();

  for (let i = 0; i < walked.length; i++) {
    const t: LimitlessTournament = walked[i];

    if (t.players < minPlayers) {
      result.tournamentsSkipped++;
      opts.onProgress?.({
        tournament: t.name,
        index: i,
        total: walked.length,
        teamsFound: 0,
      });
      continue;
    }

    let teamsFound = 0;
    try {
      const standings = await getTournamentStandings(t.id);
      const withTeams = standings.filter((s) => s.team.length > 0);
      const topSlice = withTeams.slice(0, topCut);

      for (const standing of topSlice) {
        result.standingsConsidered++;
        const species = standing.team.map((p) => p.species).filter(Boolean);
        if (species.length === 0) continue;

        const { buildFingerprint } = await import("./fingerprint");
        const fp = buildFingerprint(species);
        const isNew = !fingerprintsSeenThisRun.has(fp);
        fingerprintsSeenThisRun.add(fp);

        const seenAt = t.date ? new Date(t.date).getTime() : null;

        upsertMetaTeam({
          source: "limitless",
          sourceRef: `${t.id}::${standing.name}::${standing.placement}`,
          sourceUrl: `https://play.limitlesstcg.com/tournament/${t.id}`,
          format: internalFormat,
          author: standing.name,
          record: `#${standing.placement} @ ${t.name}`,
          archetype: null,
          description: null,
          species,
          pokemon: standing.team.map((p) => ({
            species: p.species,
            ability: p.ability || undefined,
            item: p.item || undefined,
            moves: p.moves,
            teraType: p.tera || undefined,
          })),
          trust: 0.95,
          seenAt: seenAt || Date.now(),
        });

        if (isNew) {
          result.teamsInserted++;
          teamsFound++;
        } else {
          result.teamsUpdated++;
        }
      }

      result.tournamentsScanned++;
    } catch (err) {
      result.errors.push({
        tournament: t.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    opts.onProgress?.({
      tournament: t.name,
      index: i,
      total: walked.length,
      teamsFound,
    });
  }

  return result;
}
