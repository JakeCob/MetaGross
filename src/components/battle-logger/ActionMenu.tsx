"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DamageInput } from "./DamageInput";
import { SwitchSelector } from "./SwitchSelector";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { TurnAction, ActivePokemon, Slot, Side } from "@/lib/types/battle";

type MenuPhase =
  | "moves"
  | "target"
  | "damage"
  | "switch";

export interface ActionMenuProps {
  pokemon: TeamPokemon;
  slot: Slot;
  /** Active Pokemon on the opponent's side */
  opponentActive: ActivePokemon[];
  /** Brought-4 Pokemon for my side (for switches) */
  myBrought: TeamPokemon[];
  /** My currently active Pokemon */
  myActive: ActivePokemon[];
  /** Whether this Pokemon has already mega-evolved */
  hasMegaEvolved: boolean;
  onAction: (action: TurnAction) => void;
  onClose: () => void;
}

export function ActionMenu({
  pokemon,
  slot,
  opponentActive,
  myBrought,
  myActive,
  hasMegaEvolved,
  onAction,
  onClose,
}: ActionMenuProps) {
  const [phase, setPhase] = useState<MenuPhase>("moves");
  const [selectedMove, setSelectedMove] = useState<string | null>(null);
  const [megaWithMove, setMegaWithMove] = useState(false);
  const [targetSide, setTargetSide] = useState<Side | null>(null);
  const [targetSlot, setTargetSlot] = useState<Slot | null>(null);

  const canMega = !!pokemon.megaEvolution && !hasMegaEvolved;

  // ----- Move selection -----
  const handleMoveSelect = (move: string, withMega: boolean) => {
    setSelectedMove(move);
    setMegaWithMove(withMega);
    setPhase("target");
  };

  // ----- Target selection -----
  const handleTargetSelect = (side: Side, tSlot: Slot) => {
    setTargetSide(side);
    setTargetSlot(tSlot);
    setPhase("damage");
  };

  const handleSpreadTarget = () => {
    // Spread move — target both opponents. We'll record target as opponent slot 1
    // with a convention that "spread" hits both. For simplicity, target slot 1.
    setTargetSide("p2");
    setTargetSlot(1);
    setPhase("damage");
  };

  // ----- Damage confirmation -----
  const handleDamageConfirm = (
    damage: number,
    wasCrit: boolean,
    wasKo: boolean,
  ) => {
    if (!selectedMove || !targetSide || !targetSlot) return;
    const action: TurnAction = {
      side: "p1",
      slot,
      actionType: megaWithMove ? "mega_move" : "move",
      moveName: selectedMove,
      targetSide,
      targetSlot,
      damageDealtPercent: damage,
      wasCriticalHit: wasCrit,
      wasKo: wasKo,
      megaEvolved: megaWithMove,
    };
    onAction(action);
    onClose();
  };

  // ----- Switch -----
  const handleSwitchSelect = (newSpecies: string) => {
    const action: TurnAction = {
      side: "p1",
      slot,
      actionType: "switch",
      switchOutSpecies: pokemon.species,
      switchInSpecies: newSpecies,
    };
    onAction(action);
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">
          {pokemon.species}
          {phase !== "moves" && (
            <span className="ml-2 text-sm font-normal text-muted">
              {phase === "target" && `- ${selectedMove}`}
              {phase === "damage" && `- ${selectedMove}`}
              {phase === "switch" && "- Switch"}
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted hover:text-foreground transition-colors cursor-pointer"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Phase: Move selection */}
      {phase === "moves" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {pokemon.moves.map((move) => {
              if (!move) return null;
              return (
                <Button
                  key={move}
                  variant="outline"
                  size="lg"
                  className="w-full justify-center text-sm font-medium"
                  onClick={() => handleMoveSelect(move, false)}
                >
                  {move}
                </Button>
              );
            })}
          </div>

          {/* Mega + Move (if available) */}
          {canMega && (
            <div>
              <p className="text-xs text-muted mb-2">Mega Evolve + Move:</p>
              <div className="grid grid-cols-2 gap-2">
                {pokemon.moves.map((move) => {
                  if (!move) return null;
                  return (
                    <Button
                      key={`mega-${move}`}
                      variant="outline"
                      size="sm"
                      className="w-full justify-center text-xs border-warning/40 text-warning hover:bg-warning/10"
                      onClick={() => handleMoveSelect(move, true)}
                    >
                      Mega + {move}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Switch button */}
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => setPhase("switch")}
          >
            Switch Out
          </Button>
        </div>
      )}

      {/* Phase: Target selection */}
      {phase === "target" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">Select target:</p>
          <div className="grid grid-cols-2 gap-2">
            {opponentActive.map((opp, i) => (
              <Button
                key={opp.species}
                variant="outline"
                size="lg"
                className="w-full justify-center border-destructive/30 hover:bg-destructive/10"
                disabled={opp.hpPercent <= 0}
                onClick={() => handleTargetSelect("p2", (i + 1) as Slot)}
              >
                {opp.species}
                {opp.hpPercent <= 0 ? " (KO)" : ""}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={handleSpreadTarget}
          >
            Spread (hits both)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPhase("moves")}
          >
            Back
          </Button>
        </div>
      )}

      {/* Phase: Damage input */}
      {phase === "damage" && targetSlot && targetSide && (
        <DamageInput
          targetName={
            targetSide === "p2"
              ? opponentActive[targetSlot - 1]?.species ?? "Target"
              : myActive[targetSlot - 1]?.species ?? "Target"
          }
          onConfirm={handleDamageConfirm}
          onCancel={() => setPhase("target")}
        />
      )}

      {/* Phase: Switch */}
      {phase === "switch" && (
        <SwitchSelector
          brought={myBrought}
          active={myActive}
          switchOutSpecies={pokemon.species}
          onSelect={handleSwitchSelect}
          onCancel={() => setPhase("moves")}
        />
      )}
    </div>
  );
}
