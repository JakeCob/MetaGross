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

export async function createThread(
  data: CreateThreadInput,
): Promise<AgentThreadRow> {
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
export async function getThread(id: string): Promise<AgentThreadRow | null> {
  return (
    (await db
      .select()
      .from(agentThreads)
      .where(eq(agentThreads.id, id))
      .get()) ?? null
  );
}

// ---------------------------------------------------------------------------
// listThreads
// ---------------------------------------------------------------------------
export async function listThreads(
  contextType?: string,
): Promise<AgentThreadRow[]> {
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

export async function updateThread(
  id: string,
  data: UpdateThreadInput,
): Promise<AgentThreadRow | null> {
  const existing = await db
    .select()
    .from(agentThreads)
    .where(eq(agentThreads.id, id))
    .get();
  if (!existing) return null;

  const now = Date.now();
  const updateFields: Record<string, unknown> = { updatedAt: now };
  if (data.title !== undefined) updateFields.title = data.title;
  if (data.persona !== undefined) updateFields.persona = data.persona;

  await db.update(agentThreads).set(updateFields).where(eq(agentThreads.id, id)).run();

  return (
    (await db.select().from(agentThreads).where(eq(agentThreads.id, id)).get()) ??
    null
  );
}

// ---------------------------------------------------------------------------
// deleteThread
// ---------------------------------------------------------------------------
export async function deleteThread(id: string): Promise<boolean> {
  const result = await db
    .delete(agentThreads)
    .where(eq(agentThreads.id, id))
    .run();
  // libSQL exposes `rowsAffected`; better-sqlite3 used `changes`. Cover both.
  const r = result as unknown as { rowsAffected?: number; changes?: number };
  return (r.rowsAffected ?? r.changes ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Thread titling — derive a short title from the first user message.
// ---------------------------------------------------------------------------
export function deriveThreadTitle(userMessage: string): string {
  const cleaned = userMessage
    .replace(/[#*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Untitled chat";
  if (cleaned.length <= 60) return cleaned;
  const truncated = cleaned.slice(0, 60);
  const lastSpace = truncated.lastIndexOf(" ");
  const base = lastSpace > 30 ? truncated.slice(0, lastSpace) : truncated;
  return `${base}…`;
}
