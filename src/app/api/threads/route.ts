import { NextResponse } from "next/server";
import { listThreads } from "@/lib/db/queries/agent-threads";

/**
 * GET /api/threads
 *
 * List all chat threads, newest first. Optionally filtered by
 * contextType ('team' | 'match' | 'general') and contextId so the
 * team-builder sidebar only shows team-building chats, etc.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const contextType = url.searchParams.get("contextType") ?? undefined;
  const contextId = url.searchParams.get("contextId") ?? undefined;

  let threads = listThreads(contextType);

  // listThreads filters on contextType; contextId is applied in-memory
  // because the row count is small.
  if (contextId) {
    threads = threads.filter((t) => t.contextId === contextId);
  }

  return NextResponse.json({
    threads: threads.map((t) => ({
      id: t.id,
      title: t.title,
      contextType: t.contextType,
      contextId: t.contextId,
      persona: t.persona,
      provider: t.provider,
      model: t.model,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
  });
}
