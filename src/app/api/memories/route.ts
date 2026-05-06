import { NextResponse } from "next/server";
import {
  createMemory,
  listMemories,
  countMemories,
} from "@/lib/db/queries/agent-memories";
import { embed } from "@/lib/ai/embeddings";
import { z } from "zod";

/**
 * GET /api/memories — list (filter by scope/kind) + count.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? undefined;
  const kind = url.searchParams.get("kind") ?? undefined;
  const limit = Math.min(
    500,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "100", 10) || 100),
  );
  const [memories, counts] = await Promise.all([
    listMemories({ scope, kind, limit }),
    countMemories(),
  ]);
  return NextResponse.json({ memories, counts });
}

const createSchema = z.object({
  scope: z.enum(["global", "team", "matchup", "thread"]),
  scopeRef: z.string().optional(),
  kind: z.enum([
    "preference",
    "strategy",
    "correction",
    "team_style",
    "opponent_pattern",
  ]),
  summary: z.string().min(1).max(200),
  content: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * POST /api/memories — manual memory insert. Embeds on the way in so
 * future retrieval can semantic-search against it.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const { scope, scopeRef, kind, summary, content, confidence } = parsed.data;
  const vec = await embed(`${summary}\n${content}`);
  const memory = await createMemory({
    scope,
    scopeRef: scopeRef ?? null,
    kind,
    summary,
    content,
    confidence: confidence ?? 0.7,
    embedding: vec?.vector ?? null,
    embeddingModel: vec?.model ?? null,
  });
  return NextResponse.json({ memory });
}
