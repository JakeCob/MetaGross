import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type {
  BattleMode,
  BattleResult,
  Turn,
  TurnAction,
  FieldState,
  ActivePokemon,
  Side,
  Slot,
} from "@/lib/types/battle";
import { DEFAULT_FIELD_STATE } from "@/lib/types/battle";
import type {
  ScoutingResult,
  ScoutingStatus,
  WinCondition,
} from "@/lib/ai/opponent-scouting/types";
import {
  getSwitchInEffect,
  guardDogFlipsIntimidate,
  resistsIntimidate,
} from "@/lib/engine/ability-effects";

export type BattlePhase =
  | "idle"
  | "teamEntry"
  | "teamPreview"
  | "inProgress"
  | "complete";

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
  /** Populated once the Opponent Scouting multi-agent graph has run. */
  scoutingAnalysis: ScoutingResult | null;
  /** User-editable checklist (agent-suggested + user-added). */
  winConditions: WinCondition[];
}

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

  // Turn management (new)
  currentTurn: number;
  fieldState: FieldState;
  activeP1: ActivePokemon[];
  activeP2: ActivePokemon[];
  currentTurnActions: TurnAction[];
  faintedP1: string[];
  faintedP2: string[];

  // Metadata
  format: string;
  opponentName: string;
  notes: string;

  // Opponent scouting — see src/lib/ai/opponent-scouting for the graph
  scoutingAnalysis: ScoutingResult | null;
  /**
   * Hash of the opponent-team snapshot + revealed items/abilities that the
   * last scouting run was keyed on. When the current hash diverges from
   * this, the result is stale and needs a re-run.
   */
  scoutingHash: string | null;
  scoutingStatus: ScoutingStatus;
  /** Win conditions (agent-suggested + user). Auto-tracked by shape. */
  winConditions: WinCondition[];

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
  /**
   * Reveal / correct known fields for an opponent's Pokemon mid-battle.
   * E.g., after seeing "Intimidate cut Attack!", log the Pokemon's
   * ability; after they flinch from a Covert Cloak-negated Fake Out,
   * log the item; etc. Matches by species name in opponentTeam.
   */
  updateOpponentPokemonInfo: (
    species: string,
    info: { ability?: string; item?: string },
  ) => void;

  // Opponent scouting actions
  setScoutingAnalysis: (result: ScoutingResult | null) => void;
  setScoutingStatus: (status: ScoutingStatus) => void;
  setScoutingHash: (hash: string | null) => void;
  setWinConditions: (list: WinCondition[]) => void;
  addWinCondition: (cond: WinCondition) => void;
  updateWinCondition: (id: string, patch: Partial<WinCondition>) => void;
  removeWinCondition: (id: string) => void;

  reset: () => void;
  getMatchData: () => MatchData | null;

  // Turn management actions (new)
  initializeBattle: () => void;
  addAction: (action: TurnAction) => void;
  removeAction: (index: number) => void;
  commitTurn: () => void;
  setFieldState: (field: Partial<FieldState>) => void;
  updateActivePokemon: (
    side: Side,
    slot: Slot,
    updates: Partial<ActivePokemon>,
  ) => void;
  handleKo: (side: Side, slot: Slot) => void;
  handleSwitch: (side: Side, slot: Slot, newSpecies: string) => void;
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
  // Turn management initial state
  currentTurn: 1,
  fieldState: { ...DEFAULT_FIELD_STATE } as FieldState,
  activeP1: [] as ActivePokemon[],
  activeP2: [] as ActivePokemon[],
  currentTurnActions: [] as TurnAction[],
  faintedP1: [] as string[],
  faintedP2: [] as string[],
  // Opponent scouting initial state
  scoutingAnalysis: null as ScoutingResult | null,
  scoutingHash: null as string | null,
  scoutingStatus: "idle" as ScoutingStatus,
  winConditions: [] as WinCondition[],
};

function makeActivePokemon(species: string): ActivePokemon {
  return {
    species,
    hpPercent: 100,
    status: null,
    isMega: false,
    boosts: {},
  };
}

/**
 * Apply Intimidate: drop target's Atk by -1 (clamped to -6). Guard Dog
 * absorbs the drop and grants +1 Atk to the Guard Dog user instead.
 * Immune abilities (Clear Body, Hyper Cutter, ...) skip the drop.
 */
function applyIntimidateOn(
  targets: ActivePokemon[],
  targetTeamAbilityOf: (species: string) => string | undefined,
): ActivePokemon[] {
  return targets.map((t) => {
    if (t.hpPercent <= 0) return t;
    const ability = targetTeamAbilityOf(t.species);
    if (resistsIntimidate(ability)) return t;
    if (guardDogFlipsIntimidate(ability)) {
      const cur = t.boosts.atk ?? 0;
      return { ...t, boosts: { ...t.boosts, atk: Math.max(-6, Math.min(6, cur + 1)) } };
    }
    const cur = t.boosts.atk ?? 0;
    return { ...t, boosts: { ...t.boosts, atk: Math.max(-6, cur - 1) } };
  });
}

export const useBattleLogger = create<BattleLoggerState>()(
  persist(
    (set, get) => ({
      ...initialState,

      startBattle: (mode) =>
        set({
          ...initialState,
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

      updateOpponentPokemonInfo: (species, info) => {
        const current = get().opponentTeam;
        set({
          opponentTeam: current.map((p) =>
            p.species === species
              ? {
                  ...p,
                  ...(info.ability !== undefined
                    ? { ability: info.ability }
                    : {}),
                  ...(info.item !== undefined ? { item: info.item } : {}),
                }
              : p,
          ),
        });
      },

      proceedToTeamPreview: () => {
        const { myTeam, opponentTeam } = get();
        if (myTeam.length > 0 && opponentTeam.length > 0) {
          set({ phase: "teamPreview" });
        }
      },

      setMyBrought: (species) => {
        if (species.length !== 4) return;
        const teamSpecies = get().myTeam.map((p) => p.species);
        if (species.every((s) => teamSpecies.includes(s))) {
          set({ myBrought: species });
        }
      },

      // opponentBrought starts with the 2 leads and grows as the opponent
      // reveals their back-row Pokemon via switch-in during the match.
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

      // Opponent leads must be on their revealed 6 — there is no known
      // brought-4 to validate against.
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

      // --- Opponent scouting ---
      setScoutingAnalysis: (result) => set({ scoutingAnalysis: result }),
      setScoutingStatus: (status) => set({ scoutingStatus: status }),
      setScoutingHash: (hash) => set({ scoutingHash: hash }),
      setWinConditions: (list) => set({ winConditions: list }),
      addWinCondition: (cond) =>
        set((state) => ({ winConditions: [...state.winConditions, cond] })),
      updateWinCondition: (id, patch) =>
        set((state) => ({
          winConditions: state.winConditions.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        })),
      removeWinCondition: (id) =>
        set((state) => ({
          winConditions: state.winConditions.filter((c) => c.id !== id),
        })),

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
          scoutingAnalysis: state.scoutingAnalysis,
          winConditions: state.winConditions,
        };
      },

      // --- Turn management actions ---

      initializeBattle: () => {
        const { myLeads, opponentLeads, myTeam, opponentTeam } = get();
        // Start with clean field state, then layer in any ability-driven
        // weather/terrain from the four leads.
        const field: FieldState = { ...DEFAULT_FIELD_STATE };
        const myAbilityOf = (sp: string) =>
          myTeam.find((p) => p.species === sp)?.ability;
        const oppAbilityOf = (sp: string) =>
          opponentTeam.find((p) => p.species === sp)?.ability;
        const leadAbilities = [
          ...myLeads.map(myAbilityOf),
          ...opponentLeads.map(oppAbilityOf),
        ];
        for (const ability of leadAbilities) {
          const effect = getSwitchInEffect(ability);
          if (!effect) continue;
          if (effect.weather) field.weather = effect.weather;
          if (effect.terrain) field.terrain = effect.terrain;
        }

        let activeP1 = myLeads.map(makeActivePokemon);
        let activeP2 = opponentLeads.map(makeActivePokemon);
        // Intimidate on my leads → drop opponent lead Atk.
        for (const sp of myLeads) {
          if (myAbilityOf(sp) === "Intimidate") {
            activeP2 = applyIntimidateOn(activeP2, oppAbilityOf);
          }
        }
        // Intimidate on opponent leads → drop my lead Atk.
        for (const sp of opponentLeads) {
          if (oppAbilityOf(sp) === "Intimidate") {
            activeP1 = applyIntimidateOn(activeP1, myAbilityOf);
          }
        }

        set({
          currentTurn: 1,
          fieldState: field,
          activeP1,
          activeP2,
          currentTurnActions: [],
        });
      },

      addAction: (action) => {
        set((state) => ({
          currentTurnActions: [...state.currentTurnActions, action],
        }));
      },

      removeAction: (index) => {
        set((state) => ({
          currentTurnActions: state.currentTurnActions.filter(
            (_, i) => i !== index,
          ),
        }));
      },

      commitTurn: () => {
        const { currentTurn, currentTurnActions, fieldState, activeP1, activeP2, turns } = get();
        const turn: Turn = {
          number: currentTurn,
          actions: [...currentTurnActions],
          fieldState: { ...fieldState },
          activeP1: activeP1.map((p) => ({ ...p })),
          activeP2: activeP2.map((p) => ({ ...p })),
        };
        set({
          turns: [...turns, turn],
          currentTurn: currentTurn + 1,
          currentTurnActions: [],
        });
      },

      setFieldState: (field) => {
        set((state) => ({
          fieldState: { ...state.fieldState, ...field },
        }));
      },

      updateActivePokemon: (side, slot, updates) => {
        const key = side === "p1" ? "activeP1" : "activeP2";
        set((state) => {
          const list = [...state[key]];
          const idx = slot - 1;
          if (list[idx]) {
            list[idx] = { ...list[idx], ...updates };
          }
          return { [key]: list };
        });
      },

      handleKo: (side, slot) => {
        const activeKey = side === "p1" ? "activeP1" : "activeP2";
        const faintedKey = side === "p1" ? "faintedP1" : "faintedP2";
        set((state) => {
          const list = [...state[activeKey]];
          const idx = slot - 1;
          const fainted = [...state[faintedKey]];
          if (list[idx]) {
            const species = list[idx].species;
            list[idx] = { ...list[idx], hpPercent: 0 };
            if (!fainted.includes(species)) {
              fainted.push(species);
            }
          }
          return { [activeKey]: list, [faintedKey]: fainted };
        });
      },

      handleSwitch: (side, slot, newSpecies) => {
        const key = side === "p1" ? "activeP1" : "activeP2";
        const oppKey = side === "p1" ? "activeP2" : "activeP1";
        set((state) => {
          const list = [...state[key]];
          const idx = slot - 1;
          list[idx] = makeActivePokemon(newSpecies);

          // Auto-apply ability switch-in effects (Drizzle → rain, Electric
          // Surge → electric terrain, etc.). Look up the ability from
          // myTeam / opponentTeam — respects any user-entered reveals.
          const myAbilityOf = (sp: string) =>
            state.myTeam.find((p) => p.species === sp)?.ability;
          const oppAbilityOf = (sp: string) =>
            state.opponentTeam.find((p) => p.species === sp)?.ability;
          const resolveAbility = (s: Side, sp: string) =>
            s === "p1" ? myAbilityOf(sp) : oppAbilityOf(sp);

          const ability = resolveAbility(side, newSpecies);
          const effect = getSwitchInEffect(ability);
          const patch: { [k: string]: unknown } = { [key]: list };
          if (effect) {
            const next: Partial<FieldState> = {};
            if (effect.weather) next.weather = effect.weather;
            if (effect.terrain) next.terrain = effect.terrain;
            patch.fieldState = { ...state.fieldState, ...next };
          }

          // Intimidate: if the switched-in Pokemon has Intimidate, drop
          // the OPPOSING side's Atk (respecting immunity + Guard Dog).
          if (ability === "Intimidate") {
            const opposingAbilityOf =
              side === "p1" ? oppAbilityOf : myAbilityOf;
            patch[oppKey] = applyIntimidateOn(state[oppKey], opposingAbilityOf);
          }

          return patch as Partial<BattleLoggerState>;
        });
      },
    }),
    {
      name: "metagross-battle-logger",
      partialize: (state) => ({
        phase: state.phase,
        mode: state.mode,
        myTeam: state.myTeam,
        opponentTeam: state.opponentTeam,
        myTeamId: state.myTeamId,
        myBrought: state.myBrought,
        opponentBrought: state.opponentBrought,
        myLeads: state.myLeads,
        opponentLeads: state.opponentLeads,
        turns: state.turns,
        result: state.result,
        format: state.format,
        opponentName: state.opponentName,
        notes: state.notes,
        // Persist turn management state
        currentTurn: state.currentTurn,
        fieldState: state.fieldState,
        activeP1: state.activeP1,
        activeP2: state.activeP2,
        currentTurnActions: state.currentTurnActions,
        faintedP1: state.faintedP1,
        faintedP2: state.faintedP2,
        // Persist scouting state
        scoutingAnalysis: state.scoutingAnalysis,
        scoutingHash: state.scoutingHash,
        scoutingStatus: state.scoutingStatus,
        winConditions: state.winConditions,
      }),
    },
  ),
);
