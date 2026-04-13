"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PokemonSprite } from "@/components/pokemon-sprite";
import type { TeamPokemon } from "@/lib/types/pokemon";

export interface PokemonSlotCardProps {
  pokemon: Partial<TeamPokemon>;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

export function PokemonSlotCard({
  pokemon,
  index,
  isSelected,
  onSelect,
  onRemove,
}: PokemonSlotCardProps) {
  const hasPokemon = Boolean(pokemon.species?.trim());

  if (!hasPokemon) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="w-full cursor-pointer"
      >
        <Card
          className={`h-full min-h-[180px] border-dashed transition-all hover:border-primary/50 hover:bg-accent/5 ${
            isSelected
              ? "border-primary ring-2 ring-primary/40"
              : "border-border/60"
          }`}
        >
          <CardContent className="flex h-full flex-col items-center justify-center gap-2 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground/50"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
            </div>
            <span className="text-sm text-muted-foreground">Add Pokemon</span>
            <span className="text-[10px] text-muted-foreground/60">
              Slot {index + 1}
            </span>
          </CardContent>
        </Card>
      </button>
    );
  }

  const moves = (pokemon.moves ?? ["", "", "", ""]).filter(Boolean);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className="relative w-full cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
    >
      <Card
        className={`h-full min-h-[180px] transition-all hover:ring-2 hover:ring-primary/40 ${
          isSelected
            ? "ring-2 ring-primary bg-card/95"
            : "bg-card/80 border-border/50"
        }`}
      >
        {/* Remove button */}
        <div className="absolute top-2 right-2 z-10">
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-5 w-5 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </Button>
        </div>

        <CardContent className="flex flex-col items-center gap-2 pt-3 pb-3 px-3">
          {/* Sprite */}
          <div className="flex h-[72px] w-[72px] items-center justify-center">
            <PokemonSprite species={pokemon.species!} size={68} />
          </div>

          {/* Species name */}
          <span className="text-sm font-semibold text-foreground leading-tight text-center truncate w-full">
            {pokemon.species}
          </span>

          {/* Item */}
          {pokemon.item && (
            <span className="text-[11px] text-muted-foreground truncate w-full text-center">
              {pokemon.item}
            </span>
          )}

          {/* Nature + Ability */}
          <div className="flex flex-wrap items-center justify-center gap-1 text-[10px] text-muted-foreground">
            {pokemon.nature && pokemon.nature !== "Hardy" && (
              <span>{pokemon.nature}</span>
            )}
            {pokemon.nature && pokemon.nature !== "Hardy" && pokemon.ability && (
              <span className="text-border">|</span>
            )}
            {pokemon.ability && (
              <span className="truncate max-w-[100px]">{pokemon.ability}</span>
            )}
          </div>

          {/* Moves as small badges */}
          {moves.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1 mt-0.5">
              {moves.map((move, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="text-[9px] px-1.5 py-0 h-4"
                >
                  {move}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
