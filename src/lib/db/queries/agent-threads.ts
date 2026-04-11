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
