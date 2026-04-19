import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  listMetaTeams,
  matchMetaTeams,
  countMetaTeams,
} from "@/lib/meta-teams/queries";

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
    "Search the meta-team pool (tournament teams from Pikalytics/Limitless, Reddit posts, creator teams, user submissions). Use this before proposing a team so you can cite real tournament rosters. Supports three modes: 'match' (find teams containing a given species list), 'list' (browse recent teams, optionally filtered by source/archetype), 'count' (how many teams are in the pool).",
  schema: z.object({
    mode: z
      .enum(["match", "list", "count"])
      .describe("match = find teams containing these species; list = recent teams; count = pool stats"),
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
  }),
  func: async ({ mode, species, source, archetype, format, limit }) => {
    const fmt = format ?? "champions-reg-m-a";
    const cap = limit ?? 8;

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
      });
    }

    // mode === "list"
    const rows = listMetaTeams(fmt, cap * 3); // over-fetch then filter
    const filtered = rows.filter((row) => {
      if (source && row.source !== source) return false;
      if (archetype) {
        const needle = archetype.toLowerCase();
        if (!row.archetype?.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
    return JSON.stringify({
      teams: filtered.slice(0, cap).map((row) => ({
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
    });
  },
});
