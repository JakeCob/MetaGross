import { createStore } from "zustand/vanilla";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { BattleMode, BattleResult, Turn } from "@/lib/types/battle";

export type BattlePhase =
  | "idle"
  | "teamEntry"
  | "teamPreview"
  | "inProgress"
  | "complete";

export interface BattleLoggerState {
  // Phase management
  phase: BattlePhase;
  mode: BattleMode | null;

  // Team data
  myTeam: TeamPokemon[];
  opponentTeam: Partial<TeamPokemon>[];
  myTeamId: string | null;

  // Team preview selections
  myBrought: string[];
  opponentBrought: string[];
  myLeads: string[];
  opponentLeads: string[];

  // Battle state
  turns: Turn[];
  result: BattleResult | null;

  // Metadata
  format: string;
  opponentName: string;
  notes: string;

  // Actions
  startBattle: (mode: BattleMode) => void;
  setMyTeam: (team: TeamPokemon[], teamId?: string) => void;
  setOpponentTeam: (team: Partial<TeamPokemon>[]) => void;
  proceedToTeamPreview: () => void;
  setMyBrought: (species: string[]) => void;
  setOpponentBrought: (species: string[]) => void;
  setMyLeads: (species: string[]) => void;
  setOpponentLeads: (species: string[]) => void;
  proceedToBattle: () => void;
  endBattle: (result: BattleResult) => void;
  setOpponentName: (name: string) => void;
  setNotes: (notes: string) => void;
  reset: () => void;
  getMatchData: () => MatchData | null;
}

export interface MatchData {
  format: string;
  mode: BattleMode;
  result: BattleResult;
  myTeam: TeamPokemon[];
  myTeamId: string | null;
  opponentTeam: Partial<TeamPokemon>[];
  myBrought: string[];
  opponentBrought: string[];
  myLeads: string[];
  opponentLeads: string[];
  turns: Turn[];
  opponentName: string;
  notes: string;
}

const initialState = {
  phase: "idle" as BattlePhase,
  mode: null as BattleMode | null,
  myTeam: [] as TeamPokemon[],
  opponentTeam: [] as Partial<TeamPokemon>[],
  myTeamId: null as string | null,
  myBrought: [] as string[],
  opponentBrought: [] as string[],
  myLeads: [] as string[],
  opponentLeads: [] as string[],
  turns: [] as Turn[],
  result: null as BattleResult | null,
  format: "champions-reg-m-a",
  opponentName: "",
  notes: "",
};

export function createBattleLoggerStore() {
  return createStore<BattleLoggerState>((set, get) => ({
    ...initialState,

    startBattle: (mode) =>
      set({
        phase: "teamEntry",
        mode,
      }),

    setMyTeam: (team, teamId) =>
      set({
        myTeam: team,
        myTeamId: teamId ?? null,
      }),

    setOpponentTeam: (team) =>
      set({
        opponentTeam: team,
      }),

    proceedToTeamPreview: () => {
      const { myTeam, opponentTeam } = get();
      if (myTeam.length > 0 && opponentTeam.length > 0) {
        set({ phase: "teamPreview" });
      }
    },

    setMyBrought: (species) => {
      if (species.length !== 4) return;
      // Validate all species are from myTeam
      const teamSpecies = get().myTeam.map((p) => p.species);
      if (species.every((s) => teamSpecies.includes(s))) {
        set({ myBrought: species });
      }
    },

    // Opponent's brought-4 can't be known up front — the user only sees the
    // 2 leads at match start. We accept 2-4 entries here (starts at 2, grows
    // as the opponent's back Pokemon switch in during the match).
    setOpponentBrought: (species) => {
      if (species.length < 2 || species.length > 4) return;
      const teamSpecies = get().opponentTeam.map((p) => p.species!);
      if (species.every((s) => teamSpecies.includes(s))) {
        set({ opponentBrought: species });
      }
    },

    setMyLeads: (species) => {
      if (species.length !== 2) return;
      const brought = get().myBrought;
      if (species.every((s) => brought.includes(s))) {
        set({ myLeads: species });
      }
    },

    // Opponent leads must be on their revealed 6, not on `opponentBrought`
    // (which is only seeded with 2 at match start).
    setOpponentLeads: (species) => {
      if (species.length !== 2) return;
      const teamSpecies = get().opponentTeam.map((p) => p.species!);
      if (species.every((s) => teamSpecies.includes(s))) {
        set({ opponentLeads: species });
      }
    },

    proceedToBattle: () => {
      const { myBrought, myLeads, opponentLeads } = get();
      if (
        myBrought.length === 4 &&
        myLeads.length === 2 &&
        opponentLeads.length === 2
      ) {
        set({ phase: "inProgress" });
      }
    },

    endBattle: (result) =>
      set({
        phase: "complete",
        result,
      }),

    setOpponentName: (name) => set({ opponentName: name }),
    setNotes: (notes) => set({ notes }),

    reset: () => set({ ...initialState }),

    getMatchData: () => {
      const state = get();
      if (!state.result || !state.mode) return null;
      return {
        format: state.format,
        mode: state.mode,
        result: state.result,
        myTeam: state.myTeam,
        myTeamId: state.myTeamId,
        opponentTeam: state.opponentTeam,
        myBrought: state.myBrought,
        opponentBrought: state.opponentBrought,
        myLeads: state.myLeads,
        opponentLeads: state.opponentLeads,
        turns: state.turns,
        opponentName: state.opponentName,
        notes: state.notes,
      };
    },
  }));
}
