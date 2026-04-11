import { Annotation } from "@langchain/langgraph";
import type { TeamPokemon, EVSpread } from "@/lib/types/pokemon";

// ---------------------------------------------------------------------------
// Simulation result (one row per meta threat check)
// ---------------------------------------------------------------------------
export interface SimulationResult {
  threat: string;
  survives: boolean;
  damageRange: string;
  speedComparison: string;
}

// ---------------------------------------------------------------------------
// A single entry in the spread history
// ---------------------------------------------------------------------------
export interface SpreadHistoryEntry {
  spread: EVSpread;
  nature: string;
  source: string;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// EV Debate State Annotation
// ---------------------------------------------------------------------------
export const EVDebateState = Annotation.Root({
  // Input (set once at invocation)
  pokemon: Annotation<TeamPokemon>({
    reducer: (_prev, next) => next,
    default: () =>
      ({
        species: "",
        ability: "",
        item: "",
        nature: "Hardy",
        level: 50,
        moves: ["", "", "", ""],
        evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      }) as TeamPokemon,
  }),
  team: Annotation<TeamPokemon[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  format: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "champions-reg-m-a",
  }),

  // Debate state
  currentSpread: Annotation<EVSpread>({
    reducer: (_prev, next) => next,
    default: () => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }),
  }),
  currentNature: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "Hardy",
  }),
  spreadHistory: Annotation<SpreadHistoryEntry[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Reviews
  wolfeReview: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  cybertronReview: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // Simulation
  simulationResults: Annotation<SimulationResult[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  // Output
  finalSpread: Annotation<EVSpread | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  finalNature: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  finalReasoning: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // Iteration control
  iterations: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  maxIterations: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 2,
  }),
});

export type EVDebateStateType = typeof EVDebateState.State;
export type EVDebateStateUpdate = typeof EVDebateState.Update;
