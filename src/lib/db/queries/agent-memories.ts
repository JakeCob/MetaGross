import { eq, and } from 'drizzle-orm';
import { db } from '../index';
import { agentMemories } from '../schema';

// ---------------------------------------------------------------------------
// Row shape returned to the API layer
// ---------------------------------------------------------------------------
export interface AgentMemoryRow {
  id: string;
  scope: string | null;
  scopeRef: string | null;
  kind: string | null;
  summary: string | null;
  content: string | null;
  confidence: number | null;
  sourceFeedbackId: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

// ---------------------------------------------------------------------------
// createMemory
// ---------------------------------------------------------------------------
export interface CreateMemoryInput {
  scope: string;
  scopeRef?: string | null;
  kind: string;
  summary: string;
  content: string;
  confidence?: number;
  sourceFeedbackId?: string | null;
}

export function createMemory(data: CreateMemoryInput): AgentMemoryRow {
  const now = Date.now();

  return db
    .insert(agentMemories)
    .values({
      scope: data.scope,
      scopeRef: data.scopeRef ?? null,
      kind: data.kind,
      summary: data.summary,
      content: data.content,
      confidence: data.confidence ?? 0.5,
      sourceFeedbackId: data.sourceFeedbackId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

// ---------------------------------------------------------------------------
// getMemoriesByScope
// ---------------------------------------------------------------------------
export function getMemoriesByScope(
  scope: string,
  scopeRef?: string | null,
): AgentMemoryRow[] {
  if (scopeRef) {
    return db
      .select()
      .from(agentMemories)
      .where(
        and(eq(agentMemories.scope, scope), eq(agentMemories.scopeRef, scopeRef)),
      )
      .all();
  }

  return db
    .select()
    .from(agentMemories)
    .where(eq(agentMemories.scope, scope))
    .all();
}

// ---------------------------------------------------------------------------
// searchMemories
// ---------------------------------------------------------------------------
export function searchMemories(
  kind: string,
  scope?: string,
): AgentMemoryRow[] {
  if (scope) {
    return db
      .select()
      .from(agentMemories)
      .where(
        and(eq(agentMemories.kind, kind), eq(agentMemories.scope, scope)),
      )
      .all();
  }

  return db
    .select()
    .from(agentMemories)
    .where(eq(agentMemories.kind, kind))
    .all();
}
