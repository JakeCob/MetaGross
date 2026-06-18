import { StateGraph, START, END } from "@langchain/langgraph";
import { EVDebateState, type SimulationResult } from "./state";
import type { EVDebateStateType } from "./state";
import { proposeSpreadNode } from "./nodes/propose-spread";
import { wolfeReviewNode } from "./nodes/wolfe-review";
import { cybertronReviewNode } from "./nodes/cybertron-review";
import { simulateNode, simulateInitialNode } from "./nodes/simulate";
import { finalizeNode } from "./nodes/finalize";
import type { TeamPokemon, EVSpread } from "@/lib/types/pokemon";
import { createSessionLogger } from "@/lib/ai/logger";
import { detectProvider, getModelName } from "@/lib/ai/graph/model";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

// ---------------------------------------------------------------------------
// Conditional edge: after finalize, loop back or end
// ---------------------------------------------------------------------------
function shouldLoop(state: EVDebateStateType): "propose_spread" | "__end__" {
  // If we haven't hit max iterations AND simulation found weaknesses, loop
  if (state.iterations < state.maxIterations) {
    const failures = state.simulationResults.filter((r) => !r.survives);
    if (failures.length > 0 && !state.finalSpread) {
      return "propose_spread";
    }
  }
  return "__end__";
}

// ---------------------------------------------------------------------------
// Build the debate graph
// Order: simulate (baseline) → propose full set → wolfe → cybertron →
//        simulate (post-debate) → finalize → [loop back to propose?]
// ---------------------------------------------------------------------------
function buildDebateGraph() {
  const graph = new StateGraph(EVDebateState)
    .addNode("simulate_initial", simulateInitialNode)
    .addNode("propose_spread", proposeSpreadNode)
    .addNode("wolfe_review", wolfeReviewNode)
    .addNode("cybertron_review", cybertronReviewNode)
    .addNode("simulate", simulateNode)
    .addNode("finalize", finalizeNode)
    .addEdge(START, "simulate_initial")
    .addEdge("simulate_initial", "propose_spread")
    .addEdge("propose_spread", "wolfe_review")
    .addEdge("wolfe_review", "cybertron_review")
    .addEdge("cybertron_review", "simulate")
    .addEdge("simulate", "finalize")
    .addConditionalEdges("finalize", shouldLoop, {
      propose_spread: "propose_spread",
      __end__: END,
    });

  return graph.compile();
}

// Lazy singleton
let _compiled: ReturnType<typeof buildDebateGraph> | null = null;

function getDebateGraph() {
  if (!_compiled) {
    _compiled = buildDebateGraph();
  }
  return _compiled;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export interface EVDebateResult {
  spread: EVSpread;
  nature: string;
  moves: string[];
  ability: string;
  item: string;
  reasoning: string;
  wolfeComment: string;
  cybertronComment: string;
  /** Simulation run with the user's original set (baseline). */
  initialBenchmarks: SimulationResult[];
  /** Simulation run with the proposed set after debate. */
  benchmarks: SimulationResult[];
  iterations: number;
}

/**
 * Run the multi-agent EV debate to optimize a Pokemon's EV spread.
 *
 * @param pokemon  The Pokemon being optimized
 * @param team     The full team (other 5 Pokemon)
 * @param format   Format string (default: "champions-reg-m-a")
 * @returns Optimized spread with reasoning and debate comments
 */
export async function optimizeEVSpread(
  pokemon: TeamPokemon,
  team: TeamPokemon[],
  format: string = ACTIVE_REGULATION_FORMAT_ID,
): Promise<EVDebateResult> {
  const provider = detectProvider();
  const logger = createSessionLogger("ev-debate", provider, getModelName(provider));
  logger.start({ species: pokemon.species, format });

  const graph = getDebateGraph();

  const input = {
    pokemon,
    team,
    format,
    currentSpread: pokemon.evs,
    currentNature: pokemon.nature,
    currentMoves: [...pokemon.moves],
    currentAbility: pokemon.ability,
    currentItem: pokemon.item,
    iterations: 0,
    maxIterations: 2,
  };

  const startTime = Date.now();
  const finalState = await graph.invoke(input);
  const durationMs = Date.now() - startTime;

  const result: EVDebateResult = {
    spread: finalState.finalSpread ?? finalState.currentSpread,
    nature: finalState.finalNature ?? finalState.currentNature,
    moves: (finalState.finalMoves ?? finalState.currentMoves) as string[],
    ability: finalState.finalAbility ?? finalState.currentAbility ?? pokemon.ability,
    item: finalState.finalItem ?? finalState.currentItem ?? pokemon.item,
    reasoning: finalState.finalReasoning ?? "Optimization complete.",
    wolfeComment: finalState.wolfeReview ?? "",
    cybertronComment: finalState.cybertronReview ?? "",
    initialBenchmarks: finalState.initialSimulationResults ?? [],
    benchmarks: finalState.simulationResults ?? [],
    iterations: finalState.iterations,
  };

  logger.end({
    species: pokemon.species,
    iterations: result.iterations,
    durationMs,
    finalSpread: result.spread,
    wolfe: result.wolfeComment.slice(0, 200),
    cybertron: result.cybertronComment.slice(0, 200),
  });

  return result;
}

/**
 * Stream the EV debate, yielding state snapshots after each node.
 * Used by the API route for progressive UI updates.
 */
export async function* streamEVDebate(
  pokemon: TeamPokemon,
  team: TeamPokemon[],
  format: string = ACTIVE_REGULATION_FORMAT_ID,
): AsyncGenerator<{ node: string; state: EVDebateStateType }> {
  const graph = getDebateGraph();

  const input = {
    pokemon,
    team,
    format,
    currentSpread: pokemon.evs,
    currentNature: pokemon.nature,
    currentMoves: [...pokemon.moves],
    currentAbility: pokemon.ability,
    currentItem: pokemon.item,
    iterations: 0,
    maxIterations: 2,
  };

  const stream = await graph.stream(input, { streamMode: "updates" });

  for await (const chunk of stream) {
    // chunk is Record<nodeName, partialState>
    for (const [nodeName, nodeOutput] of Object.entries(chunk)) {
      yield {
        node: nodeName,
        state: nodeOutput as EVDebateStateType,
      };
    }
  }
}
