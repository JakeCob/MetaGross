/**
 * Opponent Scouting — LangGraph state annotation.
 *
 * Shape mirrors src/lib/ai/ev-debate/state.ts: replace-on-write scalars,
 * replace-on-write arrays, and an append-only history log. Per-node
 * output fields let the SSE endpoint whitelist what it streams.
 */

import { Annotation } from "@langchain/langgraph";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { DamageObservation, SpeedObservation } from "@/lib/types/ev";
import type { MechanicalFacts } from "./mechanical-facts";
import type {
  PredictedSet,
  SuggestedLead,
  ThreatRole,
  WinCondition,
} from "./types";

// ---------------------------------------------------------------------------
// Researcher output (pure-compute node — no LLM)
// ---------------------------------------------------------------------------

export interface ResearchFinding {
  species: string;
  /** Top movesets from Pikalytics (or fallback), sorted by usage. */
  pikalyticsMoves?: { name: string; usage: number }[];
  pikalyticsAbilities?: { name: string; usage: number }[];
  pikalyticsItems?: { name: string; usage: number }[];
  /** Notable teammates the species is paired with in the meta. */
  pikalyticsTeammates?: { name: string; usage: number }[];
  /** Any creator teams in our local data that match this species + a
   *  teammate present in the opponent team. */
  creatorMatches?: {
    creator: string;
    archetype: string;
    title: string;
    pokemon: string[];
  }[];
  /** True if we hit our negative cache / offline fallback and the above
   *  data is sparse. */
  degraded?: boolean;
}

// ---------------------------------------------------------------------------
// History log — audit trail across the graph
// ---------------------------------------------------------------------------

export interface ScoutingHistoryEntry {
  source: string; // node name
  summary: string;
  at: number;
}

// ---------------------------------------------------------------------------
// State annotation
// ---------------------------------------------------------------------------

export const ScoutingState = Annotation.Root({
  // ----- Inputs (set at invocation) -----

  /** The opponent's revealed team (species + any known ability/item). */
  opponentTeam: Annotation<Partial<TeamPokemon>[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  /** MY full team — used to compute lead recommendations. */
  myTeam: Annotation<TeamPokemon[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  /** MY brought-4 when known; empty otherwise. */
  myBrought: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  /** MY team's user-written strategy description — used by the synthesizer. */
  myTeamDescription: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  /** User-selected LLM override (applies to every LLM node in the scouting graph). */
  providerOverride: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  modelOverride: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  format: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => ACTIVE_REGULATION_FORMAT_ID,
  }),
  /** Hash the caller computed — used for cache invalidation downstream. */
  scoutingHash: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  /** Mid-match speed observations extracted from turn history. */
  speedObservations: Annotation<SpeedObservation[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  /** Mid-match damage observations extracted from turn history. */
  damageObservations: Annotation<DamageObservation[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  // ----- Analyzer (LLM) -----
  archetype: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  teamSynergies: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  speedControl: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  // ----- Researcher (pure compute) -----
  research: Annotation<ResearchFinding[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  // ----- Predictor (LLM → structured JSON) -----
  predictions: Annotation<PredictedSet[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  // ----- Persona reviews -----
  wolfeNote: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  cybertronNote: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  // ----- Mechanical facts (pure compute — no LLM) -----
  mechanicalFacts: Annotation<MechanicalFacts | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // ----- Synthesizer -----
  suggestedLeads: Annotation<SuggestedLead[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  watchFor: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  threatTaxonomy: Annotation<ThreatRole[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  abilityInteractions: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  lateGameWinCon: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  suggestedWinConditions: Annotation<WinCondition[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  synthesis: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  // ----- Audit -----
  history: Annotation<ScoutingHistoryEntry[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

export type ScoutingStateType = typeof ScoutingState.State;
export type ScoutingStateUpdate = typeof ScoutingState.Update;
