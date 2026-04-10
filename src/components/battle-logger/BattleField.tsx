"use client";

import { PokemonSlot } from "./PokemonSlot";
import type { ActivePokemon, Slot, Side, TurnAction } from "@/lib/types/battle";

export interface BattleFieldProps {
  activeP1: ActivePokemon[];
  activeP2: ActivePokemon[];
  currentTurnActions: TurnAction[];
  isTargeting: boolean;
  selectedSide: Side | null;
  selectedSlot: Slot | null;
  onMyPokemonTap: (slot: Slot) => void;
  onOpponentPokemonTap?: (slot: Slot) => void;
}

function slotHasAction(
  actions: TurnAction[],
  side: Side,
  slot: Slot,
): boolean {
  return actions.some((a) => a.side === side && a.slot === slot);
}

export function BattleField({
  activeP1,
  activeP2,
  currentTurnActions,
  isTargeting,
  selectedSide,
  selectedSlot,
  onMyPokemonTap,
  onOpponentPokemonTap,
}: BattleFieldProps) {
  return (
    <div className="space-y-3">
      {/* Opponent side (top) */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5 px-1">
          Opponent
        </p>
        <div className="grid grid-cols-2 gap-2">
          {activeP2.map((mon, i) => {
            const slot = (i + 1) as Slot;
            const done = slotHasAction(currentTurnActions, "p2", slot);
            return (
              <PokemonSlot
                key={`p2-${i}-${mon.species}`}
                pokemon={mon}
                isMyPokemon={false}
                isSelected={selectedSide === "p2" && selectedSlot === slot}
                isTargeting={isTargeting}
                hasAction={done}
                onClick={
                  onOpponentPokemonTap && mon.hpPercent > 0 && !done
                    ? () => onOpponentPokemonTap(slot)
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2 px-2">
        <div className="flex-1 h-px bg-card-border" />
        <span className="text-[10px] text-muted uppercase tracking-widest">
          vs
        </span>
        <div className="flex-1 h-px bg-card-border" />
      </div>

      {/* My side (bottom) */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5 px-1">
          My Pokemon
        </p>
        <div className="grid grid-cols-2 gap-2">
          {activeP1.map((mon, i) => {
            const slot = (i + 1) as Slot;
            const done = slotHasAction(currentTurnActions, "p1", slot);
            return (
              <PokemonSlot
                key={`p1-${i}-${mon.species}`}
                pokemon={mon}
                isMyPokemon={true}
                isSelected={selectedSide === "p1" && selectedSlot === slot}
                isTargeting={isTargeting}
                hasAction={done}
                onClick={
                  mon.hpPercent > 0 && !done
                    ? () => onMyPokemonTap(slot)
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
