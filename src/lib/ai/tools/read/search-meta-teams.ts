import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  listMetaTeams,
  matchMetaTeams,
  countMetaTeams,
} from "@/lib/meta-teams/queries";
import type { MetaTeam } from "@/lib/meta-teams/types";

/**
 * search_meta_teams
 *
 * Queries the shared meta-team pool (Pikalytics featured teams + Reddit
 * scrape + user-submitted + creator teams). Lets the agent cite real
 * tournament / community rosters when recommending a build or
 * proposing a variant.
 */
export const searchMetaTeamsTool = new DynamicStructuredTool({
  name: "search_meta_teams",
  description:
    "PRIMARY research tool for 'what is player X running' or 'who's running archetype Y' questions — check this FIRST, before get_tournament_teams or search_web. Queries our local pool of tournament-verified decklists (Limitless top cuts + Pikalytics featured + Reddit + user submissions + creator teams). Modes: 'byAuthor' (find teams by a player/creator name — USE THIS when the user names a player like 'Wolfe Glick'), 'match' (find teams containing a species list), 'list' (browse recent teams, filter by source/archetype), 'count' (pool stats). Returns real player names, tournament placements, and full 6-mon decklists — cite those directly.",
  schema: z.object({
    mode: z
      .enum(["byAuthor", "match", "list", "count"])
      .describe(
        "byAuthor = find teams by a player/creator name substring; match = find teams containing these species; list = recent teams; count = pool stats",
      ),
    author: z
      .string()
      .optional()
      .describe(
        "Required for mode=byAuthor. Case-insensitive substring match against author/creator name (e.g. 'Wolfe' matches 'Wolfe Glick').",
      ),
    species: z
      .array(z.string())
      .optional()
      .describe("Species to match against (mode=match). 2-6 names. Partial match returns teams with any overlap."),
    source: z
      .enum(["pikalytics", "limitless", "smogon", "reddit", "user", "creator"])
      .optional()
      .describe("Filter by source (mode=list). Omit to include all sources."),
    archetype: z
      .string()
      .optional()
      .describe("Archetype filter substring (mode=list), e.g. 'rain', 'trick room'. Case-insensitive."),
    format: z
      .string()
      .optional()
      .default("champions-reg-m-a")
      .describe("Format id. Defaults to champions-reg-m-a."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .default(8)
      .describe("Max rows to return."),
    maxPerTournament: z
      .number()
      .int()
      .min(1)
      .max(16)
      .optional()
      .default(2)
      .describe(
        "mode=list: cap how many teams come from the same Limitless tournament. Defaults to 2 so one event can't flood the result.",
      ),
  }),
  func: async ({
    mode,
    author,
    species,
    source,
    archetype,
    format,
    limit,
    maxPerTournament,
  }) => {
    const fmt = format ?? "champions-reg-m-a";
    const cap = limit ?? 8;
    const perTournamentCap = maxPerTournament ?? 2;

    if (mode === "byAuthor") {
      const needle = (author ?? "").trim().toLowerCase();
      if (!needle) {
        return JSON.stringify({
          error: "mode=byAuthor requires an `author` substring",
        });
      }
      // Over-fetch without filters, then do an in-memory substring
      // match on author. Our pool is small (<1k rows) so this is cheap.
      const rows = listMetaTeams(fmt, 200);
      const hits = rows.filter((row: MetaTeam) =>
        (row.author ?? "").toLowerCase().includes(needle),
      );
      if (hits.length === 0) {
        return JSON.stringify({
          matches: [],
          nextStep: `No teams found in our pool by author matching "${author}". Fall through to get_tournament_teams mode=player, then search_web + fetch_url. Popular handles: Wolfe Glick is usually "WolfeyVGC" on Limitless.`,
        });
      }
      // Sort by trust desc, then seenAt desc — creator > limitless > pikalytics.
      hits.sort((a, b) => {
        if (b.trust !== a.trust) return b.trust - a.trust;
        return (b.seenAt ?? 0) - (a.seenAt ?? 0);
      });
      return JSON.stringify({
        matches: hits.slice(0, cap).map((row) => ({
          source: row.source,
          author: row.author,
          record: row.record,
          archetype: row.archetype,
          description: row.description,
          sourceUrl: row.sourceUrl,
          species: row.species,
          pokemon: row.pokemon,
          trust: row.trust,
          seenAt: row.seenAt,
        })),
        nextStep:
          "Cite these teams directly. COPY the pokemon[] field VERBATIM — ability, item, moves, nature, teraType. Do NOT substitute training-data defaults. The highest-trust entry (source=creator, trust=1.0) is hand-verified from the player's own team reveal and is the best source when it exists.",
      });
    }

    if (mode === "count") {
      const stats = countMetaTeams(fmt);
      return JSON.stringify({
        format: fmt,
        total: stats.total,
        bySource: stats.bySource,
        note:
          stats.total === 0
            ? "Pool is empty — call /api/meta-teams/aggregate to pull from Pikalytics before recommending."
            : undefined,
      });
    }

    if (mode === "match") {
      const list = (species ?? []).filter((s) => typeof s === "string" && s.trim());
      if (list.length === 0) {
        return JSON.stringify({
          error: "mode=match requires at least one species",
        });
      }
      const matches = matchMetaTeams({
        species: list,
        format: fmt,
        minOverlap: Math.min(2, list.length),
        limit: cap,
      });
      if (matches.length === 0) {
        return JSON.stringify({
          matches: [],
          note: `No known teams contain ${list.length} of these species: ${list.join(", ")}.`,
        });
      }
      return JSON.stringify({
        matches: matches.map((m) => ({
          source: m.team.source,
          author: m.team.author,
          record: m.team.record,
          archetype: m.team.archetype,
          description: m.team.description,
          sourceUrl: m.team.sourceUrl,
          species: m.team.species,
          overlap: m.overlap,
          missing: m.missing,
          score: Math.round(m.score * 100) / 100,
          pokemon: m.team.pokemon,
        })),
        nextStep:
          "When you cite any of these teams to the user, COPY the pokemon[] field VERBATIM — ability, item, moves, nature, teraType. Do NOT substitute your own training-data defaults (e.g. don't write 'Chlorophyll' when the source team has 'Spicy Spray'). If a field is missing in pokemon[], omit it rather than guessing. Attribute using the author + record fields (e.g. 'Wolfe Glick — Mega Scovillain Ladder Team').",
      });
    }

    // mode === "list"
    // Over-fetch aggressively so the per-tournament cap has room to
    // bring in entries from older events. The DB is small so this is
    // still cheap.
    const rows = listMetaTeams(fmt, Math.max(cap * 10, 80));
    const filtered = rows.filter((row) => {
      if (source && row.source !== source) return false;
      if (archetype) {
        const needle = archetype.toLowerCase();
        if (!row.archetype?.toLowerCase().includes(needle)) return false;
      }
      return true;
    });

    // Diversify by tournament (source_ref prefix = Limitless tournament
    // id). Without this, all standings from the newest tournament
    // monopolize the response because listMetaTeams orders by seenAt
    // desc. Creator entries and non-limitless sources use a null /
    // unique key so they never get deduped against each other.
    const tournamentCounts = new Map<string, number>();
    const diversified: typeof filtered = [];
    for (const row of filtered) {
      let bucket: string;
      if (row.source === "limitless" && row.sourceRef) {
        bucket = row.sourceRef.split("::")[0] ?? row.sourceRef;
      } else {
        bucket = `${row.source}:${row.id ?? row.sourceRef ?? Math.random()}`;
      }
      const soFar = tournamentCounts.get(bucket) ?? 0;
      if (soFar >= perTournamentCap) continue;
      tournamentCounts.set(bucket, soFar + 1);
      diversified.push(row);
      if (diversified.length >= cap) break;
    }

    return JSON.stringify({
      teams: diversified.map((row) => ({
        source: row.source,
        author: row.author,
        record: row.record,
        archetype: row.archetype,
        description: row.description,
        sourceUrl: row.sourceUrl,
        species: row.species,
        pokemon: row.pokemon,
      })),
      totalAfterFilter: filtered.length,
      tournamentsRepresented: tournamentCounts.size,
      nextStep:
        "Results are diversified across tournaments (max " +
        perTournamentCap +
        " teams/event) so you see real meta breadth, not one event's top 8. When you cite a team, COPY the pokemon[] field VERBATIM — ability, item, moves, nature, teraType. Attribute using author + record.",
    });
  },
});
