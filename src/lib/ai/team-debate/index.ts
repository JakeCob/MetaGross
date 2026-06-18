/**
 * Multi-agent team-building debate.
 *
 * A LangGraph where specialised agents build and stress-test a VGC team
 * together, mirroring the EV-debate pattern:
 *
 *   propose_team → offense_architect → defense_architect → meta_analyst
 *     → critic_judge → [revise? loop back to propose : finalize] → END
 *
 * The critic's loop gate is DETERMINISTIC (auditTeam) so the debate always
 * terminates and never ships a team with a blocking rule violation it could
 * fix within the round budget.
 */
import { StateGraph, START, END } from "@langchain/langgraph";
import { TeamDebateState, type TeamDebateStateType } from "./state";
import { proposeTeamNode } from "./nodes/propose-team";
import { offenseArchitectNode } from "./nodes/offense-architect";
import { defenseArchitectNode } from "./nodes/defense-architect";
import { metaAnalystNode } from "./nodes/meta-analyst";
import { criticJudgeNode } from "./nodes/critic-judge";
import { finalizeNode } from "./nodes/finalize";
import type { AITeamMember } from "@/lib/team-analysis/team-context";
import { isAIAvailable } from "@/lib/ai/client";
import { createSessionLogger } from "@/lib/ai/logger";
import { detectProvider, getModelName } from "@/lib/ai/graph/model";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

/** After the judge: revise (loop) only if there are blocking errors and we
 *  still have rounds left; otherwise finalize. */
function afterCritic(state: TeamDebateStateType): "propose_team" | "finalize" {
  const errors = state.violations.filter((v) => v.severity === "error");
  if (errors.length > 0 && state.round < state.maxRounds) {
    return "propose_team";
  }
  return "finalize";
}

function buildGraph() {
  const graph = new StateGraph(TeamDebateState)
    .addNode("propose_team", proposeTeamNode)
    .addNode("offense_architect", offenseArchitectNode)
    .addNode("defense_architect", defenseArchitectNode)
    .addNode("meta_analyst", metaAnalystNode)
    .addNode("critic_judge", criticJudgeNode)
    .addNode("finalize", finalizeNode)
    .addEdge(START, "propose_team")
    .addEdge("propose_team", "offense_architect")
    .addEdge("offense_architect", "defense_architect")
    .addEdge("defense_architect", "meta_analyst")
    .addEdge("meta_analyst", "critic_judge")
    .addConditionalEdges("critic_judge", afterCritic, {
      propose_team: "propose_team",
      finalize: "finalize",
    })
    .addEdge("finalize", END);

  return graph.compile();
}

let _compiled: ReturnType<typeof buildGraph> | null = null;
function getGraph() {
  if (!_compiled) _compiled = buildGraph();
  return _compiled;
}

export interface TeamDebateOptions {
  /** Locked-in members to build around (may be empty). */
  seed?: AITeamMember[];
  /** Free-text brief / win condition. */
  brief?: string;
  format?: string;
  /** Max propose↔critique rounds (default 2). */
  maxRounds?: number;
}

function buildInput(opts: TeamDebateOptions) {
  return {
    format: opts.format ?? ACTIVE_REGULATION_FORMAT_ID,
    seed: opts.seed ?? [],
    brief: opts.brief ?? "",
    round: 0,
    maxRounds: opts.maxRounds ?? 2,
  };
}

/**
 * Stream the team debate node-by-node for progressive UI. Yields the updating
 * state after each node.
 */
export async function* streamTeamDebate(
  opts: TeamDebateOptions,
): AsyncGenerator<{ node: string; state: TeamDebateStateType }> {
  if (!isAIAvailable()) throw new Error("AI_UNAVAILABLE");
  const stream = await getGraph().stream(buildInput(opts), {
    streamMode: "updates",
  });
  for await (const chunk of stream) {
    for (const [node, output] of Object.entries(chunk)) {
      yield { node, state: output as TeamDebateStateType };
    }
  }
}

/** Run the full debate and return the final team + transcript. */
export async function runTeamDebate(opts: TeamDebateOptions) {
  if (!isAIAvailable()) throw new Error("AI_UNAVAILABLE");
  const provider = detectProvider();
  const logger = createSessionLogger(
    "team-debate",
    provider,
    getModelName(provider),
  );
  logger.start({
    seed: (opts.seed ?? []).map((m) => m.species),
    format: opts.format,
  });

  const final = await getGraph().invoke(buildInput(opts));

  logger.end({
    rounds: final.round,
    team: (final.finalTeam ?? final.draft).map((m) => m.species),
    violations: final.violations.length,
  });

  return {
    team: final.finalTeam ?? final.draft,
    summary: final.finalSummary ?? "",
    transcript: final.transcript,
    violations: final.violations,
    rounds: final.round,
  };
}
