/**
 * Backgrounded team-debate runs.
 *
 * The build is ~15-20 min — too long to hold a single SSE request (it times out
 * on serverless and drops on any network blip). Instead the start endpoint
 * creates a `debate_runs` row, processes the run OUT OF BAND (persisting progress
 * after each node + EV batch), and the UI polls the run row. Works on any
 * long-lived Node host; true serverless durability (checkpointing / a queue
 * worker) is a later phase.
 */
import { db } from "@/lib/db";
import { debateRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { streamTeamDebate, type TeamDebateOptions } from ".";
import type { DraftMember, TranscriptEntry } from "./state";
import type { EvProgress } from "./ev-pass";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

export type DebateRunStatus = "running" | "done" | "error" | "cancelled";

export interface DebateRunProgress {
  input: { seedSpecies: string[]; brief: string; format: string; mode: string };
  transcript: TranscriptEntry[];
  evProgress: EvProgress | null;
  team: DraftMember[] | null;
  summary: string;
  violations: unknown[];
  rounds: number;
}

export interface DebateRunRecord {
  id: string;
  status: DebateRunStatus;
  phase: string | null;
  progress: DebateRunProgress;
  error: string | null;
  updatedAt: number;
}

/** Cancellation flags — process-scoped (the run lives in this process). */
const cancelled = new Set<string>();
export function cancelRun(id: string): void {
  cancelled.add(id);
}

function emptyProgress(opts: TeamDebateOptions): DebateRunProgress {
  return {
    input: {
      seedSpecies: (opts.seed ?? []).map((m) => m.species),
      brief: opts.brief ?? "",
      format: opts.format ?? "",
      mode: opts.mode ?? "ladder",
    },
    transcript: [],
    evProgress: null,
    team: null,
    summary: "",
    violations: [],
    rounds: 0,
  };
}

export async function createRun(opts: TeamDebateOptions): Promise<string> {
  const rows = await db
    .insert(debateRuns)
    .values({
      userId: DEFAULT_USER_ID,
      status: "running",
      phase: "queued",
      resultJson: emptyProgress(opts) as unknown as string,
    })
    .returning()
    .all();
  return rows[0].id;
}

export async function getRun(id: string): Promise<DebateRunRecord | null> {
  const row = await db
    .select()
    .from(debateRuns)
    .where(eq(debateRuns.id, id))
    .get();
  if (!row) return null;
  return {
    id: row.id,
    status: row.status as DebateRunStatus,
    phase: row.phase,
    progress: row.resultJson as DebateRunProgress,
    error: row.error,
    updatedAt: row.updatedAt ?? 0,
  };
}

async function persist(
  id: string,
  fields: Partial<{
    status: DebateRunStatus;
    phase: string;
    resultJson: DebateRunProgress;
    error: string;
  }>,
): Promise<void> {
  await db
    .update(debateRuns)
    .set({
      ...(fields as Record<string, unknown>),
      updatedAt: Date.now(),
    })
    .where(eq(debateRuns.id, id))
    .run();
}

/**
 * Drive a debate to completion in the background, persisting progress after each
 * streamed node / EV batch. NOT awaited by the caller — fire-and-forget.
 */
export async function processRun(
  id: string,
  opts: TeamDebateOptions,
): Promise<void> {
  const progress = emptyProgress(opts);
  let lastDraft: DraftMember[] | null = null;
  try {
    for await (const { node, state } of streamTeamDebate(opts)) {
      if (cancelled.has(id)) {
        await persist(id, { status: "cancelled", phase: "cancelled" });
        return;
      }
      const s = state as Record<string, unknown>;
      const entries = s.transcript as TranscriptEntry[] | undefined;
      if (entries?.length) progress.transcript.push(...entries);
      if (s.evProgress) progress.evProgress = s.evProgress as EvProgress;
      if (s.draft) lastDraft = s.draft as DraftMember[];
      if (s.finalTeam) progress.team = s.finalTeam as DraftMember[];
      if (typeof s.finalSummary === "string") progress.summary = s.finalSummary;
      if (s.violations) progress.violations = s.violations as unknown[];
      if (typeof s.round === "number") progress.rounds = s.round;
      await persist(id, { status: "running", phase: node, resultJson: progress });
    }
    if (!progress.team) progress.team = lastDraft;
    await persist(id, { status: "done", phase: "done", resultJson: progress });
  } catch (err) {
    await persist(id, {
      status: "error",
      error: (err as Error).message ?? "Unknown error",
      resultJson: progress,
    });
  } finally {
    cancelled.delete(id);
  }
}
