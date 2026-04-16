/**
 * Opponent Scouting — LangGraph public API.
 *
 * Linear graph (no loops) so cost and latency stay predictable:
 *   START → analyzer → researcher → predictor → wolfe → cybertron → synthesizer → END
 *
 * Mirror of src/lib/ai/ev-debate/index.ts structure. The React client
 * consumes results via the SSE endpoint at /api/opponent-scouting.
 */
import { StateGraph, START, END } from "@langchain/langgraph";
import { ScoutingState } from "./state";
import type { ScoutingStateType } from "./state";
import { analyzerNode } from "./nodes/analyzer";
import { researcherNode } from "./nodes/researcher";
import { predictorNode } from "./nodes/predictor";
import { wolfeReviewNode } from "./nodes/wolfe";
import { cybertronReviewNode } from "./nodes/cybertron";
import { synthesizerNode } from "./nodes/synthesizer";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { ScoutingResult } from "./types";
import {
  hashOpponentSnapshot,
  getCachedScouting,
  setCachedScouting,
} from "./cache";
import { createSessionLogger } from "@/lib/ai/logger";
import { detectProvider, getModelName } from "@/lib/ai/graph/model";

// ---------------------------------------------------------------------------
// Build + singleton
// ---------------------------------------------------------------------------

function buildScoutingGraph() {
  const graph = new StateGraph(ScoutingState)
    .addNode("analyzer", analyzerNode)
    .addNode("researcher", researcherNode)
    .addNode("predictor", predictorNode)
    .addNode("wolfe", wolfeReviewNode)
    .addNode("cybertron", cybertronReviewNode)
    .addNode("synthesizer", synthesizerNode)
    .addEdge(START, "analyzer")
    .addEdge("analyzer", "researcher")
    .addEdge("researcher", "predictor")
    .addEdge("predictor", "wolfe")
    .addEdge("wolfe", "cybertron")
    .addEdge("cybertron", "synthesizer")
    .addEdge("synthesizer", END);

  return graph.compile();
}

let _compiled: ReturnType<typeof buildScoutingGraph> | null = null;

function getScoutingGraph() {
  if (!_compiled) _compiled = buildScoutingGraph();
  return _compiled;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ScoutingInput {
  opponentTeam: Partial<TeamPokemon>[];
  myTeam?: TeamPokemon[];
  myBrought?: string[];
  format?: string;
  /** When true, skip the positive cache and force a fresh run. */
  forceRefresh?: boolean;
}

/**
 * Synchronous (non-streaming) invocation. Returns the final result.
 * Consults the hash-keyed cache and short-circuits on a hit (unless
 * `forceRefresh` is set).
 */
export async function scoutOpponent(
  input: ScoutingInput,
): Promise<ScoutingResult> {
  const format = input.format ?? "champions-reg-m-a";
  const hash = hashOpponentSnapshot(input.opponentTeam, format);

  if (!input.forceRefresh) {
    const cached = getCachedScouting(hash);
    if (cached) return cached;
  }

  const provider = detectProvider();
  const logger = createSessionLogger("opponent-scouting", provider, getModelName(provider));
  logger.start({ hash, species: input.opponentTeam.map((p) => p.species) });

  const graph = getScoutingGraph();
  const startTime = Date.now();
  const finalState = await graph.invoke({
    opponentTeam: input.opponentTeam,
    myTeam: input.myTeam ?? [],
    myBrought: input.myBrought ?? [],
    format,
    scoutingHash: hash,
  });
  const durationMs = Date.now() - startTime;

  const result = stateToResult(finalState);
  setCachedScouting(hash, result);

  logger.end({
    hash,
    durationMs,
    archetype: result.archetype,
    predictions: result.predictedSets.length,
  });

  return result;
}

/**
 * Streaming variant. Yields one `{ node, state }` pair per graph step
 * so the API route can forward an SSE frame per node.
 */
export async function* streamScouting(
  input: ScoutingInput,
): AsyncGenerator<{ node: string; state: ScoutingStateType }> {
  const format = input.format ?? "champions-reg-m-a";
  const hash = hashOpponentSnapshot(input.opponentTeam, format);

  const graph = getScoutingGraph();
  const stream = await graph.stream(
    {
      opponentTeam: input.opponentTeam,
      myTeam: input.myTeam ?? [],
      myBrought: input.myBrought ?? [],
      format,
      scoutingHash: hash,
    },
    { streamMode: "updates" },
  );

  for await (const chunk of stream) {
    for (const [nodeName, nodeOutput] of Object.entries(chunk)) {
      yield { node: nodeName, state: nodeOutput as ScoutingStateType };
    }
  }
}

/** Convert a final graph state into the public ScoutingResult envelope. */
function stateToResult(state: ScoutingStateType): ScoutingResult {
  return {
    predictedSets: state.predictions,
    archetype: state.archetype,
    teamSynergies: state.teamSynergies,
    suggestedLeads: state.suggestedLeads,
    watchFor: state.watchFor,
    suggestedWinConditions: state.suggestedWinConditions,
    wolfeNote: state.wolfeNote,
    cybertronNote: state.cybertronNote,
    synthesis: state.synthesis,
    generatedAt: Date.now(),
    reruns: 0,
  };
}

export { hashOpponentSnapshot } from "./cache";
