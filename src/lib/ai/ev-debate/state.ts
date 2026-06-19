import { Annotation } from "@langchain/langgraph";
import type { TeamPokemon, EVSpread } from "@/lib/types/pokemon";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

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
  moves?: string[];
  ability?: string;
  item?: string;
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
    default: () => ACTIVE_REGULATION_FORMAT_ID,
  }),

  // Debate state — full set (moves/ability/item included, not just EVs)
  currentSpread: Annotation<EVSpread>({
    reducer: (_prev, next) => next,
    default: () => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }),
  }),
  currentNature: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "Hardy",
  }),
  currentMoves: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => ["", "", "", ""],
  }),
  currentAbility: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  currentItem: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
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

  // Simulation — initial (pre-proposal) and final (post-proposal)
  initialSimulationResults: Annotation<SimulationResult[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
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
  finalMoves: Annotation<string[] | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  finalAbility: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  finalItem: Annotation<string | null>({
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
