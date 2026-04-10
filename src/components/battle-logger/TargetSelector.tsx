"use client";

import { Button } from "@/components/ui/button";
import type { ActivePokemon, Side, Slot } from "@/lib/types/battle";

export interface TargetSelectorProps {
  moveName: string;
  attackerSide: Side;
  attackerSlot: Slot;
  activeP1: ActivePokemon[];
  activeP2: ActivePokemon[];
  onSelectTarget: (side: Side, slot: Slot) => void;
  onSpread: () => void;
  onCancel: () => void;
}

export function TargetSelector({
  moveName,
  attackerSide,
  attackerSlot,
  activeP1,
  activeP2,
  onSelectTarget,
  onSpread,
  onCancel,
}: TargetSelectorProps) {
  // The opposing side is the primary target
  const opponentSide: Side = attackerSide === "p1" ? "p2" : "p1";
  const opponents = opponentSide === "p2" ? activeP2 : activeP1;
  const allies = attackerSide === "p1" ? activeP1 : activeP2;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-t-2xl border border-card-border bg-card p-4 pb-8 space-y-4 animate-in slide-in-from-bottom">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Select Target
            </h3>
            <p className="text-xs text-muted mt-0.5">
              {moveName} &mdash; tap a target
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-1 text-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label="Cancel"
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

        {/* Opponent targets */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-destructive/70 mb-1.5">
            Opponents
          </p>
          <div className="grid grid-cols-2 gap-2">
            {opponents.map((opp, i) => {
              const slot = (i + 1) as Slot;
              return (
                <Button
                  key={`opp-${i}`}
                  variant="outline"
                  size="lg"
                  className="w-full justify-center border-destructive/30 hover:bg-destructive/10 hover:border-destructive/60 min-h-[48px]"
                  disabled={opp.hpPercent <= 0}
                  onClick={() => onSelectTarget(opponentSide, slot)}
                >
                  <span className="truncate">
                    {opp.species}
                    {opp.hpPercent <= 0 ? " (KO)" : ` ${Math.round(opp.hpPercent)}%`}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Ally target (for moves like Heal Pulse, Follow Me redirect, etc.) */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-accent/70 mb-1.5">
            Ally
          </p>
          <div className="grid grid-cols-2 gap-2">
            {allies.map((ally, i) => {
              const slot = (i + 1) as Slot;
              // Can't target yourself
              if (attackerSide === "p1" && slot === attackerSlot) {
                return (
                  <Button
                    key={`ally-${i}`}
                    variant="outline"
                    size="lg"
                    className="w-full justify-center min-h-[48px] opacity-40"
                    disabled
                  >
                    {ally.species} (self)
                  </Button>
                );
              }
              return (
                <Button
                  key={`ally-${i}`}
                  variant="outline"
                  size="lg"
                  className="w-full justify-center border-accent/30 hover:bg-accent/10 hover:border-accent/60 min-h-[48px]"
                  disabled={ally.hpPercent <= 0}
                  onClick={() => onSelectTarget(attackerSide, slot)}
                >
                  <span className="truncate">
                    {ally.species}
                    {ally.hpPercent <= 0 ? " (KO)" : ` ${Math.round(ally.hpPercent)}%`}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Spread option */}
        <Button
          variant="outline"
          size="lg"
          className="w-full border-warning/30 hover:bg-warning/10 hover:border-warning/60"
          onClick={onSpread}
        >
          Spread (hits both opponents)
        </Button>

        <Button variant="ghost" size="sm" className="w-full" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
