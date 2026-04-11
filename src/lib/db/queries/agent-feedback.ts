import { eq } from 'drizzle-orm';
import { db } from '../index';
import { agentFeedbackEvents } from '../schema';

// ---------------------------------------------------------------------------
// Row shape returned to the API layer
// ---------------------------------------------------------------------------
export interface AgentFeedbackRow {
  id: string;
  threadId: string | null;
  messageId: string | null;
  eventType: string | null;
  targetType: string | null;
  payloadJson: unknown;
  createdAt: number | null;
}

// ---------------------------------------------------------------------------
// createFeedback
// ---------------------------------------------------------------------------
export interface CreateFeedbackInput {
  threadId: string;
  messageId?: string | null;
  eventType: string;
  targetType: string;
  payloadJson?: unknown;
}

export function createFeedback(data: CreateFeedbackInput): AgentFeedbackRow {
  const now = Date.now();

  return db
    .insert(agentFeedbackEvents)
    .values({
      threadId: data.threadId,
      messageId: data.messageId ?? null,
      eventType: data.eventType,
      targetType: data.targetType,
      payloadJson: data.payloadJson ?? null,
      createdAt: now,
    })
    .returning()
    .get();
}

// ---------------------------------------------------------------------------
// getFeedbackForThread
// ---------------------------------------------------------------------------
export function getFeedbackForThread(threadId: string): AgentFeedbackRow[] {
  return db
    .select()
    .from(agentFeedbackEvents)
    .where(eq(agentFeedbackEvents.threadId, threadId))
    .all();
}
