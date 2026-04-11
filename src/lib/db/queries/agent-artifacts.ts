import { eq } from 'drizzle-orm';
import { db } from '../index';
import { agentArtifacts } from '../schema';

// ---------------------------------------------------------------------------
// Row shape returned to the API layer
// ---------------------------------------------------------------------------
export interface AgentArtifactRow {
  id: string;
  threadId: string | null;
  artifactType: string | null;
  title: string | null;
  contentJson: unknown;
  createdAt: number | null;
}

// ---------------------------------------------------------------------------
// createArtifact
// ---------------------------------------------------------------------------
export interface CreateArtifactInput {
  threadId: string;
  artifactType: string;
  title: string;
  contentJson?: unknown;
}

export function createArtifact(data: CreateArtifactInput): AgentArtifactRow {
  const now = Date.now();

  return db
    .insert(agentArtifacts)
    .values({
      threadId: data.threadId,
      artifactType: data.artifactType,
      title: data.title,
      contentJson: data.contentJson ?? null,
      createdAt: now,
    })
    .returning()
    .get();
}

// ---------------------------------------------------------------------------
// getArtifactsForThread
// ---------------------------------------------------------------------------
export function getArtifactsForThread(threadId: string): AgentArtifactRow[] {
  return db
    .select()
    .from(agentArtifacts)
    .where(eq(agentArtifacts.threadId, threadId))
    .all();
}
