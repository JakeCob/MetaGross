import { isAIAvailable } from "@/lib/ai/client";
import { getRegulationAnalysis } from "@/lib/ai/regulation-analysis";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

export const runtime = "nodejs";
export const maxDuration = 120;

function resolveFormat(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value
    : ACTIVE_REGULATION_FORMAT_ID;
}

/**
 * GET /api/meta/regulation-analysis?format=...
 * Read-only: returns cached AI insights (or null) — never spends tokens.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = resolveFormat(searchParams.get("format"));
    const { insights, cached } = await getRegulationAnalysis(format, {
      readOnly: true,
    });
    return Response.json({ insights, cached, aiAvailable: isAIAvailable() });
  } catch (err) {
    console.error("GET /api/meta/regulation-analysis error:", err);
    return Response.json(
      { error: "Failed to read regulation analysis" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/meta/regulation-analysis
 * Body: { format?: string, refresh?: boolean }
 * Generates (or force-refreshes) the AI insights and caches them.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const format = resolveFormat(body?.format);

    if (!isAIAvailable()) {
      return Response.json({ insights: null, cached: false, aiAvailable: false });
    }

    const { insights, cached } = await getRegulationAnalysis(format, {
      forceRefresh: Boolean(body?.refresh),
    });
    return Response.json({ insights, cached, aiAvailable: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg === "AI_PARSE_FAILED") {
      return Response.json(
        { error: "The AI returned an unreadable analysis — try again." },
        { status: 502 },
      );
    }
    console.error("POST /api/meta/regulation-analysis error:", err);
    return Response.json(
      { error: "Failed to generate regulation analysis" },
      { status: 500 },
    );
  }
}
