"use client";

import { Badge } from "@/components/ui/badge";
import { PokemonSprite } from "@/components/pokemon-sprite";
import type { ActivePokemon, StatusCondition } from "@/lib/types/battle";
import { STATUS_CODES } from "@/lib/types/battle";

function hpColor(hp: number): string {
  if (hp > 50) return "bg-success";
  if (hp > 25) return "bg-warning";
  return "bg-destructive";
}

export interface PokemonSlotProps {
  pokemon: ActivePokemon;
  isMyPokemon: boolean;
  onClick?: () => void;
  isSelected?: boolean;
  isTargeting?: boolean;
  hasAction?: boolean;
  /** 1-based move order within the current turn (1 = moved first). */
  moveOrder?: number;
}

function orderLabel(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export function PokemonSlot({
  pokemon,
  isMyPokemon,
  onClick,
  isSelected = false,
  isTargeting = false,
  hasAction = false,
  moveOrder,
}: PokemonSlotProps) {
  const isFainted = pokemon.hpPercent <= 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`relative flex w-full flex-col gap-1.5 rounded-xl border p-3 text-left transition-all min-h-[68px] ${
        isFainted
          ? "border-border/50 bg-card/50 opacity-60"
          : isSelected
            ? "border-primary bg-accent/15 ring-2 ring-accent/40"
            : isTargeting && !isMyPokemon
              ? "border-warning/50 bg-warning/5 hover:border-warning hover:bg-warning/10"
              : hasAction
                ? "border-success/40 bg-success/5"
                : isMyPokemon
                  ? "border-primary/40 bg-accent/5 hover:border-primary hover:bg-accent/10"
                  : "border-destructive/30 bg-destructive/5 hover:border-destructive/50 hover:bg-destructive/10"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      {/* Fainted overlay */}
      {isFainted && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Fainted
          </span>
        </div>
      )}

      {/* Action done indicator + move-order badge */}
      {hasAction && !isFainted && (
        <div className="absolute top-1 right-1 z-10 flex items-center gap-1">
          {moveOrder != null && (
            <span
              className="flex h-4 items-center rounded border border-primary/40 bg-primary/15 px-1 text-[9px] font-mono font-bold text-primary"
              title={`Moved ${orderLabel(moveOrder)} this turn`}
            >
              {orderLabel(moveOrder)}
            </span>
          )}
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success text-[10px] text-white font-bold">
            &#10003;
          </span>
        </div>
      )}

      {/* Species name + badges */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <PokemonSprite
            species={pokemon.species}
            size={32}
            className="shrink-0"
          />
          <span className="text-sm font-semibold text-foreground truncate">
            {pokemon.species}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {pokemon.isMega && (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0">
              Mega
            </Badge>
          )}
          {pokemon.status && STATUS_CODES[pokemon.status as StatusCondition] && (
            <span
              className={`inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-mono font-bold ${STATUS_CODES[pokemon.status as StatusCondition].color}`}
              title={pokemon.status}
            >
              {STATUS_CODES[pokemon.status as StatusCondition].code}
            </span>
          )}
        </div>
      </div>

      {/* HP Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${hpColor(pokemon.hpPercent)}`}
            style={{ width: `${Math.max(0, Math.min(100, pokemon.hpPercent))}%` }}
          />
        </div>
        <span className="text-[11px] font-mono text-muted-foreground tabular-nums w-8 text-right">
          {Math.round(pokemon.hpPercent)}%
        </span>
      </div>
    </button>
  );
}
