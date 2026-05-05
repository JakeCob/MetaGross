import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "../index";
import { agentMemories } from "../schema";
import { cosine, keywordScore } from "@/lib/ai/embeddings";

export type MemoryKind =
  | "preference"
  | "strategy"
  | "correction"
  | "team_style"
  | "opponent_pattern";

export type MemoryScope = "global" | "team" | "matchup" | "thread";

export interface AgentMemoryRow {
  id: string;
  scope: string | null;
  scopeRef: string | null;
  kind: string | null;
  summary: string | null;
  content: string | null;
  confidence: number | null;
  sourceFeedbackId: string | null;
  sourceThreadId: string | null;
  embedding: number[] | null;
  embeddingModel: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface CreateMemoryInput {
  scope: string;
  scopeRef?: string | null;
  kind: string;
  summary: string;
  content: string;
  confidence?: number;
  sourceFeedbackId?: string | null;
  sourceThreadId?: string | null;
  embedding?: number[] | null;
  embeddingModel?: string | null;
}

function rowToMemory(row: typeof agentMemories.$inferSelect): AgentMemoryRow {
  const raw = row.embedding;
  let embedding: number[] | null = null;
  if (Array.isArray(raw)) {
    embedding = raw as number[];
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) embedding = parsed;
    } catch {
      embedding = null;
    }
  }
  return {
    id: row.id,
    scope: row.scope,
    scopeRef: row.scopeRef,
    kind: row.kind,
    summary: row.summary,
    content: row.content,
    confidence: row.confidence,
    sourceFeedbackId: row.sourceFeedbackId,
    sourceThreadId: row.sourceThreadId,
    embedding,
    embeddingModel: row.embeddingModel,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createMemory(data: CreateMemoryInput): AgentMemoryRow {
  const row = db
    .insert(agentMemories)
    .values({
      scope: data.scope,
      scopeRef: data.scopeRef ?? null,
      kind: data.kind,
      summary: data.summary,
      content: data.content,
      confidence: data.confidence ?? 0.6,
      sourceFeedbackId: data.sourceFeedbackId ?? null,
      sourceThreadId: data.sourceThreadId ?? null,
      embedding: (data.embedding ?? null) as unknown as string,
      embeddingModel: data.embeddingModel ?? null,
    })
    .returning()
    .get();
  return rowToMemory(row);
}

export function getMemoriesByScope(
  scope: string,
  scopeRef?: string | null,
): AgentMemoryRow[] {
  const rows = scopeRef
    ? db
        .select()
        .from(agentMemories)
        .where(
          and(eq(agentMemories.scope, scope), eq(agentMemories.scopeRef, scopeRef)),
        )
        .all()
    : db.select().from(agentMemories).where(eq(agentMemories.scope, scope)).all();
  return rows.map(rowToMemory);
}

export function listMemories(opts?: {
  scope?: string;
  kind?: string;
  limit?: number;
}): AgentMemoryRow[] {
  const conditions = [];
  if (opts?.scope) conditions.push(eq(agentMemories.scope, opts.scope));
  if (opts?.kind) conditions.push(eq(agentMemories.kind, opts.kind));
  const whereClause = conditions.length === 0 ? undefined : and(...conditions);
  const query = db.select().from(agentMemories);
  const rows = (whereClause ? query.where(whereClause) : query)
    .orderBy(desc(agentMemories.updatedAt))
    .limit(opts?.limit ?? 200)
    .all();
  return rows.map(rowToMemory);
}

export function deleteMemory(id: string): boolean {
  const result = db
    .delete(agentMemories)
    .where(eq(agentMemories.id, id))
    .run();
  return result.changes > 0;
}

export function updateMemory(
  id: string,
  input: Partial<CreateMemoryInput>,
): AgentMemoryRow | null {
  const now = Date.now();
  const updateFields: Record<string, unknown> = { updatedAt: now };
  if (input.scope) updateFields.scope = input.scope;
  if (input.scopeRef !== undefined) updateFields.scopeRef = input.scopeRef;
  if (input.kind) updateFields.kind = input.kind;
  if (input.summary !== undefined) updateFields.summary = input.summary;
  if (input.content !== undefined) updateFields.content = input.content;
  if (input.confidence !== undefined)
    updateFields.confidence = input.confidence;
  if (input.embedding !== undefined)
    updateFields.embedding = input.embedding as unknown as string;
  if (input.embeddingModel !== undefined)
    updateFields.embeddingModel = input.embeddingModel;

  db.update(agentMemories)
    .set(updateFields)
    .where(eq(agentMemories.id, id))
    .run();

  const row = db
    .select()
    .from(agentMemories)
    .where(eq(agentMemories.id, id))
    .get();
  return row ? rowToMemory(row) : null;
}

/**
 * Find candidate memories semantically similar to given content. Used
 * by the extractor for dedupe — don't add a 5th "user prefers rain"
 * memory when one already exists.
 */
export function findSimilarMemories(opts: {
  content: string;
  embedding: number[] | null;
  scope?: string;
  threshold?: number;
  limit?: number;
}): Array<{ memory: AgentMemoryRow; score: number }> {
  const pool = listMemories({ scope: opts.scope, limit: 500 });
  const threshold = opts.threshold ?? 0.85;
  const scored: Array<{ memory: AgentMemoryRow; score: number }> = [];
  for (const m of pool) {
    let score = 0;
    if (
      opts.embedding &&
      m.embedding &&
      m.embedding.length === opts.embedding.length
    ) {
      score = cosine(opts.embedding, m.embedding);
    } else if (m.content) {
      score = keywordScore(opts.content, m.content);
    }
    if (score >= threshold) {
      scored.push({ memory: m, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, opts.limit ?? 5);
}

/**
 * Semantic search for memories relevant to a user message. Returns the
 * top-K rows ranked by similarity. Uses embeddings when available, else
 * keyword scoring so retrieval still works without an OpenAI key.
 */
export function searchRelevantMemories(opts: {
  query: string;
  queryEmbedding?: number[] | null;
  scope?: string;
  limit?: number;
  minScore?: number;
}): Array<{ memory: AgentMemoryRow; score: number }> {
  const pool = listMemories({ scope: opts.scope, limit: 500 });
  if (pool.length === 0) return [];

  const useEmbeddings = Boolean(opts.queryEmbedding);
  const minScore = opts.minScore ?? (useEmbeddings ? 0.3 : 0.1);

  const scored: Array<{ memory: AgentMemoryRow; score: number }> = [];
  for (const m of pool) {
    let score = 0;
    if (
      useEmbeddings &&
      m.embedding &&
      m.embedding.length === (opts.queryEmbedding?.length ?? -1)
    ) {
      score = cosine(opts.queryEmbedding!, m.embedding);
    } else if (m.content) {
      score = keywordScore(opts.query, m.content);
    }
    // Weight by confidence so low-certainty memories don't crowd out
    // high-certainty ones.
    const weighted = score * (0.7 + 0.3 * (m.confidence ?? 0.5));
    if (weighted >= minScore) {
      scored.push({ memory: m, score: weighted });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, opts.limit ?? 5);
}

/**
 * Legacy shim kept for backwards compatibility with earlier code paths
 * that filter by kind only.
 */
export function searchMemories(
  kind: string,
  scope?: string,
): AgentMemoryRow[] {
  return listMemories({ kind, scope, limit: 200 });
}

export function countMemories(): {
  total: number;
  byScope: Record<string, number>;
} {
  const rows = db
    .select({
      scope: agentMemories.scope,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(agentMemories)
    .groupBy(agentMemories.scope)
    .all();
  const byScope: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const key = r.scope ?? "unknown";
    byScope[key] = Number(r.count);
    total += Number(r.count);
  }
  return { total, byScope };
}
