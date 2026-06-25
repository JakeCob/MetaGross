import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock every LLM node + the EV pass so the stepper runs offline & deterministic.
vi.mock("../nodes/propose-team", () => ({
  proposeTeamNode: async (s: any) => ({
    draft: ["A", "B", "C", "D", "E", "F"].map((species) => ({ species })),
    round: s.round + 1,
    transcript: [{ agent: "propose", label: "P", round: s.round + 1, text: "p" }],
  }),
}));
vi.mock("../nodes/offense-architect", () => ({
  offenseArchitectNode: async () => ({
    offenseReview: "o",
    transcript: [{ agent: "offense", label: "O", round: 1, text: "o" }],
  }),
}));
vi.mock("../nodes/defense-architect", () => ({
  defenseArchitectNode: async () => ({
    defenseReview: "d",
    transcript: [{ agent: "defense", label: "D", round: 1, text: "d" }],
  }),
}));
vi.mock("../nodes/meta-analyst", () => ({
  metaAnalystNode: async () => ({
    analystReview: "m",
    transcript: [{ agent: "analyst", label: "M", round: 1, text: "m" }],
  }),
}));
// Critic flags a blocking error until round 2, so the debate loops exactly once.
vi.mock("../nodes/critic-judge", () => ({
  criticJudgeNode: async (s: any) => ({
    violations: s.round >= 2 ? [] : [{ severity: "error", message: "x" }],
    critique: "c",
    transcript: [{ agent: "critic", label: "C", round: s.round, text: "c" }],
  }),
}));
vi.mock("../nodes/finalize", () => ({
  finalizeNode: async (s: any) => ({
    finalTeam: s.draft,
    finalSummary: "summary",
    transcript: [{ agent: "finalize", label: "F", round: s.round, text: "f" }],
  }),
}));
vi.mock("../ev-pass", () => ({
  EV_CONCURRENCY: 2,
  optimizeEvBatch: async (team: any[], _fmt: string, start: number, count: number) => {
    const out = [...team];
    for (let i = start; i < Math.min(start + count, team.length); i++) {
      out[i] = { ...team[i], nature: "Modest", evs: { hp: 4 } };
    }
    return out;
  },
}));

import {
  initRunState,
  runStep,
  nextCursor,
  afterCritic,
  type StepCursor,
} from "../stepper";

const OPTS = { format: "champions-reg-m-b", maxRounds: 2 };

/** Drive a run from a starting cursor/state to "done", recording the node path. */
async function drive(startState = initRunState(OPTS), startCursor: StepCursor = "propose_team") {
  let state = startState;
  let cursor: StepCursor = startCursor;
  const path: string[] = [];
  let guard = 0;
  while (cursor !== "done") {
    if (guard++ > 50) throw new Error("did not terminate");
    const res = await runStep(state, cursor, OPTS);
    path.push(res.node);
    state = res.state;
    cursor = res.nextStep;
  }
  return { state, path };
}

describe("afterCritic / nextCursor", () => {
  it("loops to propose only with a blocking error and rounds left", () => {
    const base = initRunState(OPTS);
    expect(afterCritic({ ...base, round: 1, violations: [{ severity: "error" } as any] })).toBe("propose_team");
    expect(afterCritic({ ...base, round: 2, violations: [{ severity: "error" } as any] })).toBe("finalize");
    expect(afterCritic({ ...base, round: 1, violations: [{ severity: "warning" } as any] })).toBe("finalize");
  });

  it("routes finalize → EV when there's a team, else done", () => {
    const base = initRunState(OPTS);
    expect(nextCursor("finalize", { ...base, finalTeam: [{ species: "A" }] })).toBe("ev:0");
    expect(nextCursor("finalize", { ...base, finalTeam: [], draft: [] })).toBe("done");
  });
});

describe("runStep full drive", () => {
  it("runs the whole graph, loops the critic once, then EV-batches to done", async () => {
    const { state, path } = await drive();
    expect(path).toEqual([
      "propose_team", "offense_architect", "defense_architect", "meta_analyst", "critic_judge", // round 1 (errors)
      "propose_team", "offense_architect", "defense_architect", "meta_analyst", "critic_judge", // round 2 (clean)
      "finalize",
      "ev_progress", "ev_progress", "ev_done", // 6 members / concurrency 2 = 3 batches
    ]);
    // EV applied to every member.
    expect(state.finalTeam).toHaveLength(6);
    expect(state.finalTeam!.every((m) => m.evs)).toBe(true);
    // Transcript accumulated across both rounds (not replaced):
    // 5 nodes (propose,offense,defense,meta,critic) * 2 rounds + finalize = 11.
    expect(state.transcript.length).toBe(11);
  });

  it("reports EV progress per batch", async () => {
    // Fast-forward to the EV phase.
    let state = initRunState(OPTS);
    let cursor: StepCursor = "propose_team";
    while (cursor !== "ev:0") {
      const r = await runStep(state, cursor, OPTS);
      state = r.state;
      cursor = r.nextStep;
    }
    const r0 = await runStep(state, "ev:0", OPTS);
    expect(r0.evProgress).toEqual({ done: 2, total: 6, optimizing: [] });
    expect(r0.nextStep).toBe("ev:2");
    expect(r0.done).toBe(false);
  });
});

describe("resumability", () => {
  it("resumes from a persisted mid-run checkpoint and still completes identically", async () => {
    // Run 3 steps, then snapshot (serialize/deserialize as the DB would).
    let state = initRunState(OPTS);
    let cursor: StepCursor = "propose_team";
    for (let i = 0; i < 3; i++) {
      const r = await runStep(state, cursor, OPTS);
      state = r.state;
      cursor = r.nextStep;
    }
    const snapshot = JSON.parse(JSON.stringify(state)) as typeof state;
    expect(cursor).toBe("meta_analyst");

    // Resume from the snapshot — a *fresh* call, as a different process would.
    const resumed = await drive(snapshot, cursor);
    expect(resumed.state.finalTeam).toHaveLength(6);
    expect(resumed.path[resumed.path.length - 1]).toBe("ev_done");
  });
});
