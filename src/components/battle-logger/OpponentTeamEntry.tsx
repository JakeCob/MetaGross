"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpeciesSearch } from "@/components/team-builder/SpeciesSearch";
import type { SpeciesData } from "@/lib/pokemon/species";
import type { TeamPokemon } from "@/lib/types/pokemon";

interface OpponentSlot {
  species: string;
  item: string;
  ability: string;
}

const emptySlot = (): OpponentSlot => ({
  species: "",
  item: "",
  ability: "",
});

export interface OpponentTeamEntryProps {
  onComplete: (team: Partial<TeamPokemon>[]) => void;
}

export function OpponentTeamEntry({ onComplete }: OpponentTeamEntryProps) {
  const [slots, setSlots] = useState<OpponentSlot[]>(() =>
    Array.from({ length: 6 }, emptySlot),
  );

  const filledCount = slots.filter((s) => s.species).length;
  const allFilled = filledCount === 6;

  const updateSlot = useCallback(
    (index: number, patch: Partial<OpponentSlot>) => {
      setSlots((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next;
      });
    },
    [],
  );

  const handleSpeciesSelect = useCallback(
    (index: number, species: SpeciesData) => {
      updateSlot(index, {
        species: species.name,
        ability: species.abilities[0] ?? "",
      });
    },
    [updateSlot],
  );

  const clearSlot = useCallback((index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = emptySlot();
      return next;
    });
  }, []);

  const handleContinue = useCallback(() => {
    const team: Partial<TeamPokemon>[] = slots
      .filter((s) => s.species)
      .map((s) => ({
        species: s.species,
        item: s.item || undefined,
        ability: s.ability || undefined,
      })) as Partial<TeamPokemon>[];
    onComplete(team);
  }, [slots, onComplete]);

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h2 className="text-xl font-semibold text-foreground">
          Opponent Team (OTS)
        </h2>
        <p className="mt-1 text-sm text-muted">
          Enter the 6 Pokemon visible on your opponent&apos;s team sheet.
        </p>
      </div>

      <div className="space-y-3">
        {slots.map((slot, i) => (
          <div
            key={i}
            className="rounded-lg border border-card-border bg-card p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs font-medium text-muted">
                {i + 1}
              </span>
              {slot.species ? (
                <div className="flex items-center gap-2 flex-1">
                  <span className="font-medium text-sm text-foreground">
                    {slot.species}
                  </span>
                  <button
                    type="button"
                    onClick={() => clearSlot(i)}
                    className="ml-auto text-xs text-muted hover:text-destructive cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="flex-1">
                  <SpeciesSearch
                    onChange={(species) => handleSpeciesSelect(i, species)}
                    placeholder={`Pokemon ${i + 1}...`}
                  />
                </div>
              )}
            </div>

            {slot.species && (
              <div className="grid grid-cols-2 gap-2 pl-8">
                <Input
                  placeholder="Item (optional)"
                  value={slot.item}
                  onChange={(e) => updateSlot(i, { item: e.target.value })}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Ability (optional)"
                  value={slot.ability}
                  onChange={(e) => updateSlot(i, { ability: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className="text-sm text-muted">
          {filledCount}/6 Pokemon entered
        </span>
        <Button onClick={handleContinue} disabled={!allFilled}>
          Continue
        </Button>
      </div>
    </div>
  );
}
