import { suggestTeams, type SuggestMode } from "@/lib/meta-teams/suggest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES: SuggestMode[] = ["featured", "playstyle", "meta"];

/**
 * GET /api/meta-teams/suggest?mode=featured&species=Pyroar&format=…
 *
 * Ranked proven-team suggestions for the builder's Suggestions panel. The AI
 * mode is handled by the debate panel, not here. (Distinct from
 * /api/teams/suggestions, which fills single slots on a partial team.)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const modeParam = url.searchParams.get("mode") ?? "featured";
    const mode: SuggestMode = MODES.includes(modeParam as SuggestMode)
      ? (modeParam as SuggestMode)
      : "featured";
    const species = url.searchParams.get("species") ?? undefined;
    const format = url.searchParams.get("format") ?? undefined;
    const limitParam = Number(url.searchParams.get("limit"));
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

    const result = await suggestTeams({ mode, species, format, limit });
    return Response.json(result);
  } catch (err) {
    console.error("GET /api/meta-teams/suggest error:", err);
    return Response.json(
      {
        error: "Failed to build suggestions",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
