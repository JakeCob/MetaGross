// Types for EV Intelligence Engine

import type { EVSpread } from './pokemon';

export interface MetaSpread {
  evs: EVSpread;
  nature: string;
  usagePercent: number;
  source: 'pikalytics' | 'smogon' | 'manual' | 'search';
  rank: number;
}

export interface DamageObservation {
  attackerSpecies: string;
  attackerItem?: string;
  attackerAbility?: string;
  attackerEvs?: EVSpread;
  attackerNature?: string;
  moveName: string;
  defenderSpecies: string;
  damagePercent: number;
  wasCriticalHit?: boolean;
  fieldWeather?: string;
  fieldTerrain?: string;
}

export interface SpeedObservation {
  pokemonA: string;
  pokemonB: string;
  aMovedFirst: boolean;
  fieldState?: {
    trickRoom?: boolean;
    tailwind?: 'a' | 'b' | null;
  };
}

export interface EVPrediction {
  predictedEvs: Partial<EVSpread>;
  predictedNature: string;
  confidence: number;      // 0-100
  matchedSpread?: MetaSpread;
  possibleSpreads: MetaSpread[];
  observations: number;    // how many data points used
}

export interface Benchmark {
  description: string;
  met: boolean;
  evRequired: Partial<EVSpread>;
  threat: string;          // Pokemon species
  move: string;
  damageRange?: [number, number]; // min%, max%
  benchmarkType: 'survival' | 'ko' | 'speed';
}

export interface BenchmarkReport {
  pokemon: string;
  survivalBenchmarks: Benchmark[];
  koBenchmarks: Benchmark[];
  speedBenchmarks: Benchmark[];
  suggestedSpread: EVSpread;
  suggestedNature: string;
}

export interface EVSuggestion {
  pokemon: string;
  spread: EVSpread;
  nature: string;
  reasoning: string;
  source: 'benchmark' | 'top_player' | 'ai_optimized';
}
