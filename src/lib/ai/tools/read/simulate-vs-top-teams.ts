import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { scoreTeamVsTopTeams } from "@/lib/team-analysis/matchup-heuristic";

/**
 * Lightweight simulation — NOT a battle sim. It's a type-matchup + speed-tier
 * heuristic that gives a rough "how does my team hold up vs the current top
 * cut?" read. The scoring lives in `@/lib/team-analysis/matchup-heuristic`
 * (shared with the team-building suggester); this is the agent-facing wrapper.
 */
export const simulateVsTopTeamsTool = new DynamicStructuredTool({
  name: "simulate_vs_top_teams",
  description:
    "Simulate a proposed team against current Champions top-cut teams from Limitless. Returns per-matchup scores (0-100) with offense/defense/speed breakdowns + a short summary of the worst matchups. Use this AFTER validate_team_build says ok — it tells you which real tournament teams your build loses to, so you can flag those matchups for the user. Sample size: most recent 3 Limitless tournaments, top 8 from each.",
  schema: z.object({
    team: z
      .array(z.string())
      .min(1)
      .max(6)
      .describe("6 species names for the team being evaluated."),
    tournamentLimit: z
      .number()
      .int()
      .min(1)
      .max(5)
      .optional()
      .describe("How many recent tournaments to sample (default 3)."),
    topCutSize: z
      .number()
      .int()
      .min(1)
      .max(16)
      .optional()
      .describe("How many top placements per tournament to include (default 8)."),
  }),
  func: async ({ team, tournamentLimit = 3, topCutSize = 8 }) => {
    const result = await scoreTeamVsTopTeams(team, {
      tournamentLimit,
      topCutSize,
    });
    if ("error" in result) return JSON.stringify(result);
    return JSON.stringify({
      ...result,
      nextStep:
        "Cite the worst matchups in your response so the user knows where this team struggles. Offer a concrete tweak (e.g. 'swap slot 3 for a Fairy-resist') if average score < 50.",
    });
  },
});
