import { NextResponse } from "next/server";
import { createRun, processRun } from "@/lib/ai/team-debate/runs";
import { normalizeMode } from "@/lib/ai/team-debate/modes";
import { isAIAvailable } from "@/lib/ai/client";
import type { AITeamMember } from "@/lib/team-analysis/team-context";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

export const runtime = "nodejs";
// The kickoff returns fast; the run is processed out-of-band. (A long debate
// still needs a long-lived host or a queue worker to finish on serverless.)
export const maxDuration = 300;

/**
 * POST /api/teams/debate/start — create a backgrounded team-debate run and
 * return its id. The client polls GET /api/teams/debate/runs/:id for progress.
 *
 * Body: { seed?, brief?, format?, mode? }
 */
export async function POST(request: Request) {
  try {
    if (!isAIAvailable()) {
      return NextResponse.json(
        { error: "AI is not configured." },
        { status: 503 },
      );
    }
    const body = await request.json().catch(() => ({}));
    const seed: AITeamMember[] = Array.isArray(body?.seed) ? body.seed : [];
    const brief: string = typeof body?.brief === "string" ? body.brief : "";
    const mode = normalizeMode(body?.mode);
    const format: string =
      typeof body?.format === "string" && body.format.trim()
        ? body.format
        : ACTIVE_REGULATION_FORMAT_ID;

    const opts = { seed, brief, format, mode };
    const runId = await createRun(opts);
    // Fire-and-forget: keep processing after the response returns.
    void processRun(runId, opts);

    return NextResponse.json({ runId });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to start run" },
      { status: 500 },
    );
  }
}
