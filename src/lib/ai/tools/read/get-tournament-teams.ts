import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  getChampionsTournaments,
  getTournamentStandings,
  getTournamentUsage,
  getTournamentPokemonDetail,
} from "@/lib/pokemon/limitless";
import { ACTIVE_REGULATION_LABEL } from "@/lib/data/champions";

/**
 * get_tournament_teams
 *
 * Dedicated tool for LimitlessVGC tournament data. Replaces the
 * flaky search_web path for "what won a recent tournament?" / "what
 * is Wolfe running?" questions. Supports four modes:
 *
 *   - recent: list recent Champions tournaments
 *   - standings: pull top placements + full team lists for a tournament
 *   - usage: aggregated usage across recent tournaments
 *   - player: find a named player's recent tournament teams
 *
 * All results are cached for 24h via the limitless client so we don't
 * hammer the API.
 */
export const getTournamentTeamsTool = new DynamicStructuredTool({
  name: "get_tournament_teams",
  description:
    `Fetch tournament data from LimitlessVGC for ${ACTIVE_REGULATION_LABEL}. Use this when the user asks about tournament-winning teams, what famous players are running, or to ground recommendations in actual meta results. Four modes: 'recent' (list tournaments), 'standings' (top cut + full team lists for one tournament), 'usage' (aggregated top species across recent tournaments), 'player' (teams used by a named player).`,
  schema: z.object({
    mode: z
      .enum(["recent", "standings", "usage", "player"])
      .describe(
        "recent = list tournaments, standings = top placements for one tournament, usage = aggregate usage across tournaments, player = find teams by a player name",
      ),
    tournamentId: z
      .string()
      .optional()
      .describe("Required for mode=standings. Use mode=recent first to get IDs."),
    playerName: z
      .string()
      .optional()
      .describe("Required for mode=player. Matches case-insensitive substring."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(8)
      .describe("How many rows / tournaments to scan. Default 8."),
  }),
  func: async ({ mode, tournamentId, playerName, limit }) => {
    const cap = limit ?? 8;

    if (mode === "recent") {
      const tournaments = await getChampionsTournaments();
      if (tournaments.length === 0) {
        return JSON.stringify({
          tournaments: [],
          note: "No tournaments available — Limitless API may be unreachable.",
        });
      }
      return JSON.stringify({
        tournaments: tournaments.slice(0, cap).map((t) => ({
          id: t.id,
          name: t.name,
          date: t.date,
          format: t.format,
          players: t.players,
        })),
      });
    }

    if (mode === "standings") {
      if (!tournamentId) {
        return JSON.stringify({
          error: "tournamentId required for mode=standings",
        });
      }
      const standings = await getTournamentStandings(tournamentId);
      if (standings.length === 0) {
        return JSON.stringify({
          error: `No standings data for tournament ${tournamentId} (may be missing decklists or unreachable)`,
        });
      }
      return JSON.stringify({
        tournamentId,
        topCut: standings.slice(0, cap).map((s) => ({
          placement: s.placement,
          player: s.name,
          country: s.country,
          team: s.team,
        })),
      });
    }

    if (mode === "usage") {
      const usage = await getTournamentUsage(cap);
      if (usage.length === 0) {
        return JSON.stringify({
          error: "No usage data available from recent tournaments",
        });
      }
      return JSON.stringify({
        source: "limitless-tournaments",
        sampleSize: usage[0]?.totalTeams ?? 0,
        species: usage.slice(0, 30).map((u) => ({
          species: u.species,
          usagePercent: u.usagePercent,
          appearances: u.totalAppearances,
        })),
      });
    }

    // mode === "player"
    if (!playerName) {
      return JSON.stringify({
        error: "playerName required for mode=player",
      });
    }
    const needle = playerName.toLowerCase();
    // Popular players don't enter every week — scan a wider window.
    // `limit` still controls the returned row count; the scan itself
    // is capped separately at 25 tournaments (~2 months of data).
    const scanCap = Math.max(cap, 25);
    const tournaments = await getChampionsTournaments();
    const found: Array<{
      tournamentId: string;
      tournamentName: string;
      date: string;
      placement: number;
      country: string;
      team: ReturnType<typeof getTournamentStandings> extends Promise<infer S>
        ? S extends Array<infer E>
          ? E extends { team: infer T }
            ? T
            : never
          : never
        : never;
    }> = [];

    // Also collect near-misses so we can surface "did you mean" hints
    // — popular players use handles on Limitless, not real names.
    const partialHandleHits = new Set<string>();
    const needleShort = needle.replace(/\s+/g, "");

    for (const t of tournaments.slice(0, scanCap)) {
      const standings = await getTournamentStandings(t.id);
      for (const s of standings) {
        const lower = s.name.toLowerCase();
        if (lower.includes(needle)) {
          found.push({
            tournamentId: t.id,
            tournamentName: t.name,
            date: t.date,
            placement: s.placement,
            country: s.country,
            team: s.team,
          });
        } else if (
          needleShort.length >= 4 &&
          lower.replace(/\s+/g, "").includes(needleShort)
        ) {
          partialHandleHits.add(s.name);
        }
      }
    }

    if (found.length === 0) {
      const hints = [...partialHandleHits].slice(0, 5);
      return JSON.stringify({
        player: playerName,
        matches: [],
        scannedTournaments: Math.min(scanCap, tournaments.length),
        handleHints: hints,
        nextStep:
          hints.length > 0
            ? `NO exact match for "${playerName}" in the last ${Math.min(scanCap, tournaments.length)} tournaments. REQUIRED NEXT STEPS: (1) retry this tool with playerName="${hints[0]}" — popular players use handles on Limitless, not real names. (2) If still empty, call search_web for "${playerName} Champions team" and fetch_url the top results.`
            : `NO match for "${playerName}" in the last ${Math.min(scanCap, tournaments.length)} tournaments. REQUIRED NEXT STEPS: (1) Call search_web for "${playerName} Champions team latest" — popular players post team reveals on YouTube/Twitter/Reddit. (2) fetch_url the top 2-3 search results to read the actual content. Do NOT answer "I couldn't find it" until you've executed both steps.`,
      });
    }
    return JSON.stringify({
      player: playerName,
      matches: found.slice(0, cap),
    });
  },
});

/**
 * get_pokemon_tournament_detail
 *
 * Drill-down: move/item/ability/tera/teammate usage for a single
 * species aggregated from recent tournaments. Higher-trust than
 * Pikalytics because it's only top cuts, but the sample is smaller.
 */
export const getPokemonTournamentDetailTool = new DynamicStructuredTool({
  name: "get_pokemon_tournament_detail",
  description:
    "Get tournament-specific usage (moves, items, abilities, tera, teammates) for one species from recent Champions tournaments on LimitlessVGC. More trustworthy than Pikalytics Showdown data because it's only tournament top-cut, but smaller sample.",
  schema: z.object({
    species: z.string().describe("Species name, e.g. 'Sneasler'."),
  }),
  func: async ({ species }) => {
    const detail = await getTournamentPokemonDetail(species);
    if (!detail) {
      return JSON.stringify({
        species,
        error: "No tournament appearances found for this species in recent Champions events.",
      });
    }
    return JSON.stringify(detail);
  },
});
