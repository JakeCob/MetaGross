import { eq, desc } from 'drizzle-orm';
import { db } from '../index';
import { agentThreads } from '../schema';

// ---------------------------------------------------------------------------
// Row shape returned to the API layer
// ---------------------------------------------------------------------------
export interface AgentThreadRow {
  id: string;
  title: string | null;
  contextType: string | null;
  contextId: string | null;
  provider: string | null;
  model: string | null;
  persona: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

// ---------------------------------------------------------------------------
// createThread
// ---------------------------------------------------------------------------
export interface CreateThreadInput {
  title?: string;
  contextType: string;
  contextId?: string | null;
  provider: string;
  model: string;
  persona?: string | null;
}

export function createThread(data: CreateThreadInput): AgentThreadRow {
  const now = Date.now();

  return db
    .insert(agentThreads)
    .values({
      title: data.title ?? null,
      contextType: data.contextType,
      contextId: data.contextId ?? null,
      provider: data.provider,
      model: data.model,
      persona: data.persona ?? 'default',
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

// ---------------------------------------------------------------------------
// getThread
// ---------------------------------------------------------------------------
export function getThread(id: string): AgentThreadRow | null {
  return (
    db
      .select()
      .from(agentThreads)
      .where(eq(agentThreads.id, id))
      .get() ?? null
  );
}

// ---------------------------------------------------------------------------
// listThreads
// ---------------------------------------------------------------------------
export function listThreads(contextType?: string): AgentThreadRow[] {
  if (contextType) {
    return db
      .select()
      .from(agentThreads)
      .where(eq(agentThreads.contextType, contextType))
      .orderBy(desc(agentThreads.updatedAt))
      .all();
  }

  return db
    .select()
    .from(agentThreads)
    .orderBy(desc(agentThreads.updatedAt))
    .all();
}

// ---------------------------------------------------------------------------
// updateThread
// ---------------------------------------------------------------------------
export interface UpdateThreadInput {
  title?: string | null;
  persona?: string | null;
}

export function updateThread(id: string, data: UpdateThreadInput): AgentThreadRow | null {
  const existing = db.select().from(agentThreads).where(eq(agentThreads.id, id)).get();
  if (!existing) return null;

  const now = Date.now();
  const updateFields: Record<string, unknown> = { updatedAt: now };
  if (data.title !== undefined) updateFields.title = data.title;
  if (data.persona !== undefined) updateFields.persona = data.persona;

  db.update(agentThreads).set(updateFields).where(eq(agentThreads.id, id)).run();

  return db.select().from(agentThreads).where(eq(agentThreads.id, id)).get() ?? null;
}

// ---------------------------------------------------------------------------
// deleteThread
// ---------------------------------------------------------------------------
export function deleteThread(id: string): boolean {
  const result = db.delete(agentThreads).where(eq(agentThreads.id, id)).run();
  return result.changes > 0;
}

// ---------------------------------------------------------------------------
// Thread titling — derive a short title from the first user message.
// Keeps it deterministic and free (no extra LLM call) for v1. We can
// upgrade to an LLM summariser later if titles feel terse.
// ---------------------------------------------------------------------------
export function deriveThreadTitle(userMessage: string): string {
  const cleaned = userMessage
    // Strip markdown headings/bullets/emphasis so the title reads like prose.
    .replace(/[#*_`>]/g, "")
    // Collapse whitespace.
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Untitled chat";
  // Cut at 60 chars on a word boundary when possible.
  if (cleaned.length <= 60) return cleaned;
  const truncated = cleaned.slice(0, 60);
  const lastSpace = truncated.lastIndexOf(" ");
  const base = lastSpace > 30 ? truncated.slice(0, lastSpace) : truncated;
  return `${base}…`;
}
