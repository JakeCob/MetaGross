import { runAllScrapers, SCRAPERS } from "@/lib/meta-teams/scrapers";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * POST /api/meta-teams/scrape
 *
 * Body (optional): { only?: string[] } — restrict to named scrapers.
 *
 * Cron entrypoint for the Reddit (and future Twitter / VGC-blog)
 * scrapers. Returns a per-scraper summary with counts and any
 * per-item errors so you can spot a broken feed before teams rot.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const only =
      Array.isArray(body?.only) && body.only.length > 0
        ? (body.only as string[])
        : undefined;

    const result = await runAllScrapers({ only });
    return Response.json(result);
  } catch (err) {
    console.error("POST /api/meta-teams/scrape error:", err);
    return Response.json(
      {
        error: "Failed to run scrapers",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

/** GET lists the registered scrapers so you can verify the registry. */
export function GET() {
  return Response.json({ scrapers: Object.keys(SCRAPERS) });
}
