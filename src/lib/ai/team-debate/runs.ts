/**
 * Backgrounded team-debate runs (Phase 2 — durable, resumable).
 *
 * The build is ~15-20 min — too long for one SSE/serverless request. The start
 * endpoint creates a `debate_runs` row and processes it OUT OF BAND, persisting
 * after EVERY step (one graph node or one EV batch — see stepper.ts) along with
 * the full resumable State + a `nextStep` cursor. The UI polls the run row.
 *
 * Because each step is durably checkpointed, a run that's interrupted (a
 * serverless timeout, a host restart, a crashed task) can be RESUMED exactly
 * where it stopped: `resumeStaleRuns` (driven by the /advance cron) picks up any
 * `running` row that's gone quiet and advances it. On a long-lived host the
 * initial `processRun` simply drives to completion in-process, same UX as before.
 */
import { db } from "@/lib/db";
import { debateRuns } from "@/lib/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { type TeamDebateOptions } from ".";
import type { DraftMember, TranscriptEntry, TeamDebateStateType } from "./state";
import type { EvProgress } from "./ev-pass";
import { initRunState, runStep, type StepCursor } from "./stepper";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

/** Run to completion in-process on a long-lived host; on serverless the function
 *  is capped earlier and the /advance sweep continues the run. */
const PROCESS_BUDGET_MS = 30 * 60 * 1000;
/** A `running` run untouched for this long is presumed interrupted → resumable. */
export const STALE_MS = 90 * 1000;
/** Per-invocation work budget for the recovery sweep (well under maxDuration). */
export const ADVANCE_BUDGET_MS = 240 * 1000;

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

/** Process-scoped fast-cancel flags. Cross-process cancel is durable via the
 *  persisted status (the loop re-reads it each step). */
const cancelled = new Set<string>();
export async function cancelRun(id: string): Promise<void> {
  cancelled.add(id);
  await db
    .update(debateRuns)
    .set({ status: "cancelled", phase: "cancelled", updatedAt: Date.now() })
    .where(and(eq(debateRuns.id, id), eq(debateRuns.status, "running")))
    .run();
}

function progressFromState(
  state: TeamDebateStateType,
  evProgress: EvProgress | null,
): DebateRunProgress {
  return {
    input: {
      seedSpecies: state.seed.map((m) => m.species),
      brief: state.brief,
      format: state.format,
      mode: state.mode,
    },
    transcript: state.transcript,
    evProgress,
    team: state.finalTeam ?? (state.draft.length ? state.draft : null),
    summary: state.finalSummary ?? "",
    violations: state.violations,
    rounds: state.round,
  };
}

export async function createRun(opts: TeamDebateOptions): Promise<string> {
  const state = initRunState(opts);
  const rows = await db
    .insert(debateRuns)
    .values({
      userId: DEFAULT_USER_ID,
      status: "running",
      phase: "queued",
      resultJson: progressFromState(state, null) as unknown as string,
      stateJson: state as unknown as string,
      nextStep: "propose_team",
    })
    .returning()
    .all();
  return rows[0].id;
}

export async function getRun(id: string): Promise<DebateRunRecord | null> {
  const row = await db
    .select({
      id: debateRuns.id,
      status: debateRuns.status,
      phase: debateRuns.phase,
      resultJson: debateRuns.resultJson,
      error: debateRuns.error,
      updatedAt: debateRuns.updatedAt,
    })
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

interface RunCheckpoint {
  status: DebateRunStatus;
  state: TeamDebateStateType | null;
  nextStep: StepCursor | null;
  evProgress: EvProgress | null;
}

async function loadCheckpoint(id: string): Promise<RunCheckpoint | null> {
  const row = await db
    .select({
      status: debateRuns.status,
      stateJson: debateRuns.stateJson,
      nextStep: debateRuns.nextStep,
      resultJson: debateRuns.resultJson,
    })
    .from(debateRuns)
    .where(eq(debateRuns.id, id))
    .get();
  if (!row) return null;
  return {
    status: row.status as DebateRunStatus,
    state: (row.stateJson as TeamDebateStateType | null) ?? null,
    nextStep: (row.nextStep as StepCursor | null) ?? null,
    evProgress: (row.resultJson as DebateRunProgress | null)?.evProgress ?? null,
  };
}

/**
 * Advance a run from its persisted checkpoint, one step at a time, persisting
 * after each, until it finishes / errors / is cancelled / the time budget runs
 * out. Safe to call repeatedly and from any process — that's what makes a run
 * durable. Returns the terminal/last cursor reached.
 */
export async function advanceRun(
  id: string,
  budgetMs: number = ADVANCE_BUDGET_MS,
): Promise<{ status: DebateRunStatus; nextStep: StepCursor | null }> {
  const startedAt = Date.now();
  const cp = await loadCheckpoint(id);
  if (!cp) return { status: "error", nextStep: null };
  if (cp.status !== "running") return { status: cp.status, nextStep: cp.nextStep };
  if (!cp.state || !cp.nextStep) {
    // Legacy / Phase-1 row with no checkpoint — can't resume.
    await db
      .update(debateRuns)
      .set({ status: "error", error: "No resumable checkpoint", updatedAt: Date.now() })
      .where(eq(debateRuns.id, id))
      .run();
    return { status: "error", nextStep: null };
  }

  let state = cp.state;
  let cursor = cp.nextStep;
  let evProgress = cp.evProgress;

  try {
    while (cursor !== "done") {
      // Durable + cross-process cancel: re-read status each step.
      if (cancelled.has(id)) return { status: "cancelled", nextStep: cursor };
      const fresh = await db
        .select({ status: debateRuns.status })
        .from(debateRuns)
        .where(eq(debateRuns.id, id))
        .get();
      if (!fresh || fresh.status !== "running") {
        return { status: (fresh?.status as DebateRunStatus) ?? "error", nextStep: cursor };
      }

      const res = await runStep(state, cursor, {});
      state = res.state;
      cursor = res.nextStep;
      if (res.evProgress) evProgress = res.evProgress;

      await db
        .update(debateRuns)
        .set({
          status: res.done ? "done" : "running",
          phase: res.done ? "done" : res.node,
          resultJson: progressFromState(state, evProgress) as unknown as string,
          stateJson: state as unknown as string,
          nextStep: cursor,
          updatedAt: Date.now(),
        })
        .where(eq(debateRuns.id, id))
        .run();

      if (Date.now() - startedAt > budgetMs) {
        // Out of time for this slice — leave it `running`; the sweep continues.
        return { status: "running", nextStep: cursor };
      }
    }
    return { status: "done", nextStep: "done" };
  } catch (err) {
    await db
      .update(debateRuns)
      .set({
        status: "error",
        error: (err as Error).message ?? "Unknown error",
        resultJson: progressFromState(state, evProgress) as unknown as string,
        stateJson: state as unknown as string,
        nextStep: cursor,
        updatedAt: Date.now(),
      })
      .where(eq(debateRuns.id, id))
      .run();
    return { status: "error", nextStep: cursor };
  } finally {
    cancelled.delete(id);
  }
}

/**
 * Drive a freshly-created run to completion in the background. NOT awaited by the
 * caller — fire-and-forget. On a long-lived host this finishes the run; on
 * serverless it advances until the function is reclaimed, after which the
 * /advance sweep resumes it.
 */
export async function processRun(
  id: string,
  _opts?: TeamDebateOptions,
): Promise<void> {
  await advanceRun(id, PROCESS_BUDGET_MS);
}

/**
 * Recovery sweep: resume every `running` run that's gone quiet (interrupted by a
 * timeout/restart). Claims each by bumping updatedAt first so concurrent sweeps
 * don't double-drive the same run. Returns how many it advanced.
 */
export async function resumeStaleRuns(
  budgetMs: number = ADVANCE_BUDGET_MS,
): Promise<{ resumed: string[] }> {
  const cutoff = Date.now() - STALE_MS;
  const stale = await db
    .select({ id: debateRuns.id })
    .from(debateRuns)
    .where(and(eq(debateRuns.status, "running"), lt(debateRuns.updatedAt, cutoff)))
    .all();

  const resumed: string[] = [];
  const deadline = Date.now() + budgetMs;
  for (const { id } of stale) {
    if (Date.now() >= deadline) break;
    // Claim: bump updatedAt so another concurrent sweep sees it as fresh.
    const claim = await db
      .update(debateRuns)
      .set({ updatedAt: Date.now() })
      .where(and(eq(debateRuns.id, id), eq(debateRuns.status, "running"), lt(debateRuns.updatedAt, cutoff)))
      .run();
    if (claim.rowsAffected === 0) continue; // someone else claimed it
    resumed.push(id);
    await advanceRun(id, Math.max(0, deadline - Date.now()));
  }
  return { resumed };
}
