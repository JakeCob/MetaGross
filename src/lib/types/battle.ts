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
  /** Stat stage boosts keyed by BoostableStat; absent keys default to 0. */
  boosts: Record<string, number>;
  /**
   * Held item was removed (Knock Off, Trick, Switcheroo, Corrosive Gas,
   * Fling, Incinerate on berry, etc.). When true, resolvers treat the
   * Pokemon as item-less for damage calcs — and Unburden doubles speed.
   */
  itemRemoved?: boolean;
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
  /** The move missed (accuracy roll) or was blocked (Protect, Wide Guard, etc.). */
  wasMiss?: boolean;
  /** Status inflicted on the target as a side-effect. */
  inflictedStatus?: StatusCondition | null;
  /** Target flinched (either from this move's flinch chance or King's Rock etc.). */
  causedFlinch?: boolean;
  /** Move knocked off / stole / tricked the target's held item. */
  removedItem?: boolean;
  /** Stat changes applied as a side effect (Icy Wind Spe -1, Growl Atk -1, Power-Up Punch Atk +1, etc.). */
  statChanges?: StatChange[];
  // Switch data
  switchInSpecies?: string;
  switchOutSpecies?: string;
  // Mega
  megaEvolved?: boolean;
  /**
   * 1-based move order within this turn. The action logged first gets 1,
   * second gets 2, etc. Used by the EV reverse-calc engine to infer
   * speed order — "if the opponent's Froslass has moveOrder=1 and my
   * Sneasler has moveOrder=2, Froslass moved first."
   *
   * Switches and Mega declarations may share an order number with a
   * move (they happen at priority bracket boundaries in the real game),
   * but the key signal is: among two *move* actions from different
   * sides, the lower moveOrder went first.
   */
  moveOrder?: number;
}

/** Stats whose battle-stage changes we track on ActivePokemon.boosts. */
export type BoostableStat =
  | "atk"
  | "def"
  | "spa"
  | "spd"
  | "spe"
  | "accuracy"
  | "evasion";

/** A single stat change recorded on a TurnAction. */
export interface StatChange {
  /** Side whose Pokemon is affected. */
  side: Side;
  /** Which active slot is affected. */
  slot: Slot;
  stat: BoostableStat;
  /** Signed integer stage change: -6 to +6 per move, usually ±1 or ±2. */
  delta: number;
}

/** Status conditions we can track on an ActivePokemon or record as an action side-effect. */
export type StatusCondition =
  | "burn"
  | "paralysis"
  | "sleep"
  | "freeze"
  | "poison"
  | "toxic"
  | "confusion";

/**
 * Short codes used by the UI for compact status badges on Pokemon slots.
 * Confusion is a volatile status (resets on switch) but worth flagging.
 */
export const STATUS_CODES: Record<StatusCondition, { code: string; color: string }> = {
  burn:      { code: "BRN",  color: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  paralysis: { code: "PAR",  color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },
  sleep:     { code: "SLP",  color: "bg-slate-500/20 text-slate-300 border-slate-500/40" },
  freeze:    { code: "FRZ",  color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" },
  poison:    { code: "PSN",  color: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
  toxic:     { code: "TOX",  color: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" },
  confusion: { code: "CONF", color: "bg-pink-500/20 text-pink-300 border-pink-500/40" },
};

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
  opponentBrought: string[]; // 2–4 species — starts as the 2 leads and grows
                             // as the opponent's back Pokemon switch in
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
