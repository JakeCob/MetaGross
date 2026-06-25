import { NextResponse } from "next/server";
import { getRun, cancelRun } from "@/lib/ai/team-debate/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/teams/debate/runs/:id — poll a run's status + progress. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  return NextResponse.json(run);
}

/** DELETE /api/teams/debate/runs/:id — request cancellation. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await cancelRun(id);
  return NextResponse.json({ ok: true });
}
