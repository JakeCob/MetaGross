import { StateGraph, START, END } from "@langchain/langgraph";
import { EVDebateState, type SimulationResult } from "./state";
import type { EVDebateStateType } from "./state";
import { proposeSpreadNode } from "./nodes/propose-spread";
import { wolfeReviewNode } from "./nodes/wolfe-review";
import { cybertronReviewNode } from "./nodes/cybertron-review";
import { simulateNode } from "./nodes/simulate";
import { finalizeNode } from "./nodes/finalize";
import type { TeamPokemon, EVSpread } from "@/lib/types/pokemon";

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
// ---------------------------------------------------------------------------
function buildDebateGraph() {
  const graph = new StateGraph(EVDebateState)
    .addNode("propose_spread", proposeSpreadNode)
    .addNode("wolfe_review", wolfeReviewNode)
    .addNode("cybertron_review", cybertronReviewNode)
    .addNode("simulate", simulateNode)
    .addNode("finalize", finalizeNode)
    // Linear flow: START -> propose -> wolfe -> cybertron -> simulate -> finalize
    .addEdge(START, "propose_spread")
    .addEdge("propose_spread", "wolfe_review")
    .addEdge("wolfe_review", "cybertron_review")
    .addEdge("cybertron_review", "simulate")
    .addEdge("simulate", "finalize")
    // After finalize: conditional loop or end
    .addConditionalEdges("finalize", shouldLoop, {
      propose_spread: "propose_spread",
      __end__: END,
    });

  // No checkpointer -- stateless, no persistence needed
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
  reasoning: string;
  wolfeComment: string;
  cybertronComment: string;
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
  format: string = "champions-reg-m-a",
): Promise<EVDebateResult> {
  const graph = getDebateGraph();

  const input = {
    pokemon,
    team,
    format,
    currentSpread: pokemon.evs,
    currentNature: pokemon.nature,
    iterations: 0,
    maxIterations: 2,
  };

  const finalState = await graph.invoke(input);

  return {
    spread: finalState.finalSpread ?? finalState.currentSpread,
    nature: finalState.finalNature ?? finalState.currentNature,
    reasoning: finalState.finalReasoning ?? "Optimization complete.",
    wolfeComment: finalState.wolfeReview ?? "",
    cybertronComment: finalState.cybertronReview ?? "",
    benchmarks: finalState.simulationResults ?? [],
    iterations: finalState.iterations,
  };
}

/**
 * Stream the EV debate, yielding state snapshots after each node.
 * Used by the API route for progressive UI updates.
 */
export async function* streamEVDebate(
  pokemon: TeamPokemon,
  team: TeamPokemon[],
  format: string = "champions-reg-m-a",
): AsyncGenerator<{ node: string; state: EVDebateStateType }> {
  const graph = getDebateGraph();

  const input = {
    pokemon,
    team,
    format,
    currentSpread: pokemon.evs,
    currentNature: pokemon.nature,
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
