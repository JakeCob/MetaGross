import { NextResponse } from "next/server";
import { resumeStaleRuns, advanceRun } from "@/lib/ai/team-debate/runs";
import { isCronRequest } from "@/lib/auth/cron";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Recovery worker for durable debate runs.
 *
 * GET  (cron) — `Authorization: Bearer <CRON_SECRET>`: resume every `running`
 *               run that's gone quiet (interrupted by a serverless timeout /
 *               host restart), advancing each within the request budget. Wire a
 *               frequent Vercel cron at this path for true serverless durability.
 * POST { id } — resume one specific run now (manual / programmatic nudge, or a
 *               future UI self-heal so a stalled run restarts without waiting for
 *               the cron). Refuses to touch a run that isn't `running`. Auth comes
 *               from the normal session middleware.
 */
export async function GET(request: Request) {
  if (!isCronRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await resumeStaleRuns();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("GET /api/teams/debate/advance error:", err);
    return NextResponse.json(
      { error: "Failed to resume runs", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const id: unknown = body?.id;
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const result = await advanceRun(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("POST /api/teams/debate/advance error:", err);
    return NextResponse.json(
      { error: "Failed to advance run", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
