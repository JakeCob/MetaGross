"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBattleLogger } from "@/stores/use-battle-logger";
import { BattleField } from "./BattleField";
import { FieldStateBar } from "./FieldStateBar";
import { ActionMenu } from "./ActionMenu";
import { OpponentActionMenu } from "./OpponentActionMenu";
import { TurnLog } from "./TurnLog";
import { TurnControls } from "./TurnControls";
import type { TurnAction, Slot } from "@/lib/types/battle";
import type { TeamPokemon } from "@/lib/types/pokemon";

export interface BattleLoggerProps {
  onEndBattle: () => void;
}

export function BattleLogger({ onEndBattle }: BattleLoggerProps) {
  const store = useBattleLogger();
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedOppSlot, setSelectedOppSlot] = useState<Slot | null>(null);
  const [showTurnLog, setShowTurnLog] = useState(false);

  // Initialize battle state on mount
  useEffect(() => {
    if (store.activeP1.length === 0 && store.myLeads.length === 2) {
      store.initializeBattle();
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Find the full TeamPokemon data for the selected slot
  const getMyPokemonForSlot = useCallback(
    (slot: Slot): TeamPokemon | null => {
      const active = store.activeP1[slot - 1];
      if (!active) return null;
      return (
        store.myTeam.find((p) => p.species === active.species) ?? null
      );
    },
    [store.activeP1, store.myTeam],
  );

  // Get brought-4 as TeamPokemon[]
  const myBroughtPokemon: TeamPokemon[] = store.myBrought
    .map((species) => store.myTeam.find((p) => p.species === species))
    .filter((p): p is TeamPokemon => !!p);

  const handleMyPokemonTap = useCallback(
    (slot: Slot) => {
      const active = store.activeP1[slot - 1];
      if (!active || active.hpPercent <= 0) return;
      setSelectedSlot(slot);
    },
    [store.activeP1],
  );

  const handleOpponentPokemonTap = useCallback(
    (slot: Slot) => {
      const active = store.activeP2[slot - 1];
      if (!active || active.hpPercent <= 0) return;
      setSelectedOppSlot(slot);
    },
    [store.activeP2],
  );

  const handleAction = useCallback(
    (action: TurnAction) => {
      // Auto-stamp moveOrder: sequential within the current turn.
      const stamped: TurnAction = {
        ...action,
        moveOrder: store.currentTurnActions.length + 1,
      };
      store.addAction(stamped);

      // Apply side effects from the action
      if (stamped.wasKo && stamped.targetSide && stamped.targetSlot) {
        store.handleKo(stamped.targetSide, stamped.targetSlot);
      }

      if (
        stamped.damageDealtPercent != null &&
        stamped.targetSide &&
        stamped.targetSlot &&
        !stamped.wasKo
      ) {
        const key = stamped.targetSide === "p1" ? "activeP1" : "activeP2";
        const target = store[key][stamped.targetSlot - 1];
        if (target) {
          const newHp = Math.max(0, target.hpPercent - stamped.damageDealtPercent);
          store.updateActivePokemon(stamped.targetSide, stamped.targetSlot, {
            hpPercent: newHp,
          });
        }
      }

      if (stamped.actionType === "switch" && stamped.switchInSpecies) {
        store.handleSwitch(stamped.side, stamped.slot, stamped.switchInSpecies);
      }

      if (stamped.megaEvolved) {
        store.updateActivePokemon(stamped.side, stamped.slot, { isMega: true });
      }
    },
    [store],
  );

  const handleEndTurn = useCallback(() => {
    store.commitTurn();
  }, [store]);

  const handleUndoLastAction = useCallback(() => {
    const actions = store.currentTurnActions;
    if (actions.length === 0) return;
    store.removeAction(actions.length - 1);
  }, [store]);

  const selectedPokemon =
    selectedSlot != null ? getMyPokemonForSlot(selectedSlot) : null;

  const selectedActivePokemon =
    selectedSlot != null ? store.activeP1[selectedSlot - 1] : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Battle Logger</h2>
        <Button variant="destructive" size="sm" onClick={onEndBattle}>
          End Battle
        </Button>
      </div>

      {/* Field State Bar */}
      <FieldStateBar
        fieldState={store.fieldState}
        onChange={store.setFieldState}
      />

      {/* Battlefield */}
      <BattleField
        activeP1={store.activeP1}
        activeP2={store.activeP2}
        currentTurnActions={store.currentTurnActions}
        isTargeting={false}
        selectedSide={
          selectedSlot != null
            ? "p1"
            : selectedOppSlot != null
              ? "p2"
              : null
        }
        selectedSlot={selectedSlot ?? selectedOppSlot}
        onMyPokemonTap={handleMyPokemonTap}
        onOpponentPokemonTap={handleOpponentPokemonTap}
      />

      {/* Turn Controls */}
      <TurnControls
        currentTurn={store.currentTurn}
        actionsCount={store.currentTurnActions.length}
        canCommit={store.currentTurnActions.length > 0}
        canUndo={store.currentTurnActions.length > 0}
        onCommit={handleEndTurn}
        onUndo={handleUndoLastAction}
      />

      {/* Turn Log (collapsible) */}
      <div>
        <button
          type="button"
          onClick={() => setShowTurnLog(!showTurnLog)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <span>
            Turn History ({store.turns.length} turn{store.turns.length !== 1 ? "s" : ""})
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${showTurnLog ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {showTurnLog && (
          <TurnLog
            turns={store.turns}
            currentTurnActions={store.currentTurnActions}
            currentTurn={store.currentTurn}
          />
        )}
      </div>

      {/* Action Menu Dialog — my side */}
      <Dialog
        open={selectedSlot != null && selectedPokemon != null}
        onOpenChange={(open: boolean) => { if (!open) setSelectedSlot(null); }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Choose Action</DialogTitle>
          </DialogHeader>
          {selectedPokemon && selectedSlot != null && (
            <ActionMenu
              pokemon={selectedPokemon}
              slot={selectedSlot}
              opponentActive={store.activeP2}
              myBrought={myBroughtPokemon}
              myActive={store.activeP1}
              hasMegaEvolved={selectedActivePokemon?.isMega ?? false}
              myTeam={store.myTeam}
              opponentTeam={store.opponentTeam}
              predictions={store.scoutingAnalysis?.predictedSets}
              fieldState={store.fieldState}
              format={store.format}
              onAction={handleAction}
              onClose={() => setSelectedSlot(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Opponent Action Menu Dialog — tap their Pokemon to log their move */}
      <Dialog
        open={selectedOppSlot != null}
        onOpenChange={(open: boolean) => { if (!open) setSelectedOppSlot(null); }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Log opponent action</DialogTitle>
          </DialogHeader>
          {selectedOppSlot != null && store.activeP2[selectedOppSlot - 1] && (() => {
            const activeOpp = store.activeP2[selectedOppSlot - 1];
            const teamEntry = store.opponentTeam.find(
              (p) => p.species === activeOpp.species,
            );
            return (
              <OpponentActionMenu
                pokemon={activeOpp}
                slot={selectedOppSlot}
                knownAbility={teamEntry?.ability ?? ""}
                knownItem={teamEntry?.item ?? ""}
                myActive={store.activeP1}
                myTeam={store.myTeam}
                opponentTeam={store.opponentTeam}
                predictions={store.scoutingAnalysis?.predictedSets}
                fieldState={store.fieldState}
                format={store.format}
                onUpdateInfo={(info) => {
                  store.updateOpponentPokemonInfo(activeOpp.species, info);
                }}
                onToggleMega={(isMega) => {
                  if (selectedOppSlot != null) {
                    store.updateActivePokemon("p2", selectedOppSlot, { isMega });
                  }
                }}
                onAction={handleAction}
                onClose={() => setSelectedOppSlot(null)}
              />
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
