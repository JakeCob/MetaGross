// Types for battle logging and match data

import type { TeamPokemon } from './pokemon';

export type BattleMode = 'realtime' | 'postmatch' | 'quick';
export type BattleResult = 'win' | 'loss';
export type ActionType = 'move' | 'switch' | 'mega_move' | 'nothing';
export type Side = 'p1' | 'p2';
export type Slot = 1 | 2;

export interface FieldState {
  weather: 'rain' | 'sun' | 'sand' | 'snow' | null;
  terrain: 'electric' | 'grassy' | 'misty' | 'psychic' | null;
  trickRoom: boolean;
  tailwindP1: boolean;
  tailwindP2: boolean;
  screensP1: { reflect: boolean; lightScreen: boolean; auroraVeil: boolean };
  screensP2: { reflect: boolean; lightScreen: boolean; auroraVeil: boolean };
}

export const DEFAULT_FIELD_STATE: FieldState = {
  weather: null,
  terrain: null,
  trickRoom: false,
  tailwindP1: false,
  tailwindP2: false,
  screensP1: { reflect: false, lightScreen: false, auroraVeil: false },
  screensP2: { reflect: false, lightScreen: false, auroraVeil: false },
};

export interface ActivePokemon {
  species: string;
  hpPercent: number;    // 0-100
  status: string | null; // 'burn' | 'paralysis' | 'sleep' | 'freeze' | 'poison' | 'toxic' | null
  isMega: boolean;
  boosts: Record<string, number>;  // stat boosts/drops
}

export interface TurnAction {
  side: Side;
  slot: Slot;
  actionType: ActionType;
  // Move data
  moveName?: string;
  targetSide?: Side;
  targetSlot?: Slot;
  damageDealtPercent?: number;
  wasCriticalHit?: boolean;
  wasKo?: boolean;
  // Switch data
  switchInSpecies?: string;
  switchOutSpecies?: string;
  // Mega
  megaEvolved?: boolean;
}

export interface Turn {
  number: number;
  actions: TurnAction[];
  fieldState: FieldState;
  activeP1: ActivePokemon[];
  activeP2: ActivePokemon[];
  // Analysis (computed later)
  winProbability?: number;
  isTurningPoint?: boolean;
}

export interface BattleMatch {
  id: string;
  format: string;
  mode: BattleMode;
  result: BattleResult;
  playedAt: Date;
  notes?: string;
  // Teams
  myTeam: TeamPokemon[];
  opponentTeam: Partial<TeamPokemon>[]; // opponent may have partial info
  myBrought: string[];       // 4 species
  opponentBrought: string[]; // 4 species (best guess)
  myLeads: string[];         // 2 species
  opponentLeads: string[];   // 2 species
  // Turns
  turns: Turn[];
  // Metadata
  opponentName?: string;
  archetypeSelf?: string;
  archetypeOpponent?: string;
  // Analysis (cached)
  ruleAnalysis?: import('./analysis').MatchAnalysis;
  aiAnalysis?: import('./analysis').AIMatchAnalysis;
}
