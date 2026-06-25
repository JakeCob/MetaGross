/**
 * Resumable step-runner for the team debate (Phase 2 durability).
 *
 * Phase 1 streams the LangGraph to completion inside one background task — which
 * dies if the serverless function returns or the host restarts. Phase 2 reduces
 * the debate to a sequence of small, idempotent STEPS, each of which takes the
 * persisted State, does one unit of work (one graph node, or one EV batch), and
 * returns the new State + the cursor for the next step. The caller persists
 * State + cursor after every step, so a crashed/timed-out run resumes exactly
 * where it left off (see runs.ts + the /advance sweep).
 *
 * We DON'T use a LangGraph checkpointer: its SqliteSaver needs a better-sqlite3
 * file handle, but the app's store is libSQL/Turso (async, and on serverless the
 * only durable store). Driving the nodes directly — they're pure
 * `(state) => Partial<update>` functions with trivial replace-last reducers
 * (only `transcript` accumulates) — keeps the checkpoint a plain Turso JSON row.
 *
 * The graph this mirrors (kept identical to index.ts):
 *   propose → offense → defense → meta → critic → [revise? propose : finalize]
 *     → finalize → (EV batches) → done
 *
 * SERVER-ONLY.
 */
import "server-only";
import {
  type TeamDebateStateType,
  type TeamDebateStateUpdate,
  type TranscriptEntry,
} from "./state";
import { type TeamDebateOptions } from ".";
import { DEFAULT_MODE } from "./modes";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";
import { EV_CONCURRENCY, optimizeEvBatch, type EvProgress } from "./ev-pass";
import { proposeTeamNode } from "./nodes/propose-team";
import { offenseArchitectNode } from "./nodes/offense-architect";
import { defenseArchitectNode } from "./nodes/defense-architect";
import { metaAnalystNode } from "./nodes/meta-analyst";
import { criticJudgeNode } from "./nodes/critic-judge";
import { finalizeNode } from "./nodes/finalize";

/** The graph nodes, in linear order (the critic loop is handled separately). */
export const GRAPH_STEPS = [
  "propose_team",
  "offense_architect",
  "defense_architect",
  "meta_analyst",
  "critic_judge",
  "finalize",
] as const;
export type GraphStep = (typeof GRAPH_STEPS)[number];

/** Cursor for the next unit of work: a graph node, an EV batch ("ev:<start>"),
 *  or the terminal "done". */
export type StepCursor = GraphStep | `ev:${number}` | "done";

type NodeFn = (
  state: TeamDebateStateType,
) => Promise<Partial<TeamDebateStateUpdate>>;

const NODE_FNS: Record<GraphStep, NodeFn> = {
  propose_team: proposeTeamNode,
  offense_architect: offenseArchitectNode,
  defense_architect: defenseArchitectNode,
  meta_analyst: metaAnalystNode,
  critic_judge: criticJudgeNode,
  finalize: finalizeNode,
};

/** Fresh State for a new run (mirrors index.ts buildInput + the Annotation
 *  defaults — but as a plain object we can persist and reload). */
export function initRunState(opts: TeamDebateOptions): TeamDebateStateType {
  return {
    format: opts.format ?? ACTIVE_REGULATION_FORMAT_ID,
    seed: opts.seed ?? [],
    brief: opts.brief ?? "",
    mode: opts.mode ?? DEFAULT_MODE,
    preferredArchetypes: opts.preferredArchetypes ?? [],
    draft: [],
    offenseReview: null,
    defenseReview: null,
    analystReview: null,
    analystData: "",
    critique: null,
    violations: [],
    transcript: [],
    finalTeam: null,
    finalSummary: null,
    round: 0,
    maxRounds: opts.maxRounds ?? 2,
  };
}

/** Apply a node's partial update with the same reducers the StateGraph uses:
 *  everything is replace-last except `transcript`, which accumulates. */
function applyUpdate(
  state: TeamDebateStateType,
  update: Partial<TeamDebateStateUpdate>,
): TeamDebateStateType {
  const next: TeamDebateStateType = { ...state };
  for (const [key, value] of Object.entries(update)) {
    if (value === undefined) continue;
    if (key === "transcript") {
      next.transcript = [
        ...state.transcript,
        ...((value as TranscriptEntry[]) ?? []),
      ];
    } else {
      (next as Record<string, unknown>)[key] = value;
    }
  }
  return next;
}

/** The critic's deterministic loop gate — identical to index.ts `afterCritic`. */
export function afterCritic(state: TeamDebateStateType): "propose_team" | "finalize" {
  const errors = state.violations.filter((v) => v.severity === "error");
  return errors.length > 0 && state.round < state.maxRounds
    ? "propose_team"
    : "finalize";
}

/** Where to go after completing `step`, given the resulting state. */
export function nextCursor(step: GraphStep, state: TeamDebateStateType): StepCursor {
  switch (step) {
    case "propose_team":
      return "offense_architect";
    case "offense_architect":
      return "defense_architect";
    case "defense_architect":
      return "meta_analyst";
    case "meta_analyst":
      return "critic_judge";
    case "critic_judge":
      return afterCritic(state);
    case "finalize": {
      const team = state.finalTeam ?? state.draft;
      return team.length > 0 ? "ev:0" : "done";
    }
  }
}

export interface StepResult {
  state: TeamDebateStateType;
  /** Cursor to persist for the next call. */
  nextStep: StepCursor;
  /** Display label for the step just run (the run's `phase`). */
  node: string;
  /** EV progress, only on ev:* steps. */
  evProgress?: EvProgress;
  done: boolean;
}

const isEvStep = (s: StepCursor): s is `ev:${number}` => s.startsWith("ev:");

/**
 * Run exactly ONE step from `cursor` against `state`. Pure w.r.t. persistence —
 * the caller persists the returned state + nextStep. Resumable: call repeatedly,
 * feeding back `state` + `nextStep`, until `done`.
 */
export async function runStep(
  state: TeamDebateStateType,
  cursor: StepCursor,
  opts: TeamDebateOptions,
): Promise<StepResult> {
  void opts; // reserved (the node fns read everything they need from state)

  if (cursor === "done") {
    return { state, nextStep: "done", node: "done", done: true };
  }

  // EV batch step.
  if (isEvStep(cursor)) {
    const start = Number(cursor.slice(3)) || 0;
    const team = state.finalTeam ?? state.draft;
    const total = team.length;
    const end = Math.min(start + EV_CONCURRENCY, total);
    const optimized = await optimizeEvBatch(team, state.format, start, EV_CONCURRENCY);
    const nextState: TeamDebateStateType = { ...state, finalTeam: optimized };
    const nextStep: StepCursor = end >= total ? "done" : `ev:${end}`;
    return {
      state: nextState,
      nextStep,
      node: nextStep === "done" ? "ev_done" : "ev_progress",
      evProgress: { done: end, total, optimizing: [] },
      done: nextStep === "done",
    };
  }

  // Graph node step.
  const fn = NODE_FNS[cursor];
  const update = await fn(state);
  const nextState = applyUpdate(state, update);
  const nextStep = nextCursor(cursor, nextState);
  return { state: nextState, nextStep, node: cursor, done: false };
}
