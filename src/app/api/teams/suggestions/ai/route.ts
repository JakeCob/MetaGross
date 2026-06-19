import { isAIAvailable } from "@/lib/ai/client";
import {
  generateAITeamSuggestions,
  type AITeamMember,
} from "@/lib/team-analysis/ai-suggestions";

/**
 * POST /api/teams/suggestions/ai
 *
 * AI-powered "build around my team" suggestions — reasons about synergy,
 * coverage, and meta matchups (weather, Trick Room, prominent megas).
 *
 * Body: { team: (string | {species, item?, ability?})[], format?: string }
 * Response: { suggestions: TeamSuggestion[], aiAvailable: boolean }
 *
 * Falls back gracefully: returns { aiAvailable: false } (200) when no API
 * key is configured, so the UI can keep its heuristic suggestions.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawTeam: unknown[] = Array.isArray(body.team) ? body.team : [];
    const format: string =
      typeof body.format === "string" ? body.format : "champions-reg-m-b";

    const team: AITeamMember[] = rawTeam
      .map((m): AITeamMember | null => {
        if (typeof m === "string") return { species: m };
        if (m && typeof m === "object") {
          const o = m as Record<string, unknown>;
          if (typeof o.species === "string" && o.species.trim()) {
            return {
              species: o.species,
              item: typeof o.item === "string" ? o.item : undefined,
              ability: typeof o.ability === "string" ? o.ability : undefined,
            };
          }
        }
        return null;
      })
      .filter((m): m is AITeamMember => m !== null);

    if (team.length === 0) {
      return Response.json(
        { error: "team must be a non-empty array of species" },
        { status: 400 },
      );
    }

    if (!isAIAvailable()) {
      return Response.json({ suggestions: [], aiAvailable: false });
    }

    const suggestions = await generateAITeamSuggestions(team, format);
    return Response.json({ suggestions, aiAvailable: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg === "AI_UNAVAILABLE") {
      return Response.json({ suggestions: [], aiAvailable: false });
    }
    if (msg === "AI_PARSE_FAILED") {
      return Response.json(
        { error: "The AI returned an unreadable response — try again." },
        { status: 502 },
      );
    }
    console.error("POST /api/teams/suggestions/ai error:", err);
    return Response.json(
      { error: "Failed to generate AI suggestions" },
      { status: 500 },
    );
  }
}
