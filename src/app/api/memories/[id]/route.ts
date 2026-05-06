import { NextResponse } from "next/server";
import {
  deleteMemory,
  updateMemory,
} from "@/lib/db/queries/agent-memories";
import { embed } from "@/lib/ai/embeddings";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  summary: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(2000).optional(),
  confidence: z.number().min(0).max(1).optional(),
  kind: z
    .enum([
      "preference",
      "strategy",
      "correction",
      "team_style",
      "opponent_pattern",
    ])
    .optional(),
});

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 },
    );
  }
  // Re-embed when summary/content changed so retrieval stays accurate.
  const needsReembed =
    parsed.data.summary !== undefined || parsed.data.content !== undefined;
  let embedding: { vector: number[]; model: string } | null = null;
  if (needsReembed) {
    const summary = parsed.data.summary ?? "";
    const content = parsed.data.content ?? "";
    embedding = await embed(`${summary}\n${content}`);
  }
  const updated = await updateMemory(id, {
    ...parsed.data,
    ...(embedding
      ? { embedding: embedding.vector, embeddingModel: embedding.model }
      : {}),
  });
  if (!updated) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }
  return NextResponse.json({ memory: updated });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const ok = await deleteMemory(id);
  if (!ok) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
