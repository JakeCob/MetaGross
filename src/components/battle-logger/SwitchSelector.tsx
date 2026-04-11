"use client";

import { Button } from "@/components/ui/button";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { ActivePokemon } from "@/lib/types/battle";

export interface SwitchSelectorProps {
  /** The full brought-4 list for this side */
  brought: TeamPokemon[] | Partial<TeamPokemon>[];
  /** Currently active Pokemon on this side */
  active: ActivePokemon[];
  /** Species being switched out */
  switchOutSpecies: string;
  onSelect: (species: string) => void;
  onCancel: () => void;
}

export function SwitchSelector({
  brought,
  active,
  switchOutSpecies,
  onSelect,
  onCancel,
}: SwitchSelectorProps) {
  const activeSpecies = active.map((a) => a.species);
  // Bench = brought but not currently active, and not the one switching out
  // A fainted pokemon that was active can still be on the "active" list with 0 hp,
  // so we allow switching to bench Pokemon that are not currently in an active slot
  const bench = brought.filter((p) => {
    const species = p.species!;
    return (
      species !== switchOutSpecies &&
      !activeSpecies.includes(species)
    );
  });

  // Also include fainted active that are not the one switching out
  // (No -- bench is only non-active Pokemon. Fainted active slots get replaced.)

  if (bench.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">No bench Pokemon available.</p>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Switch <span className="font-medium text-foreground">{switchOutSpecies}</span> for:
      </p>
      <div className="grid gap-2">
        {bench.map((p) => (
          <Button
            key={p.species}
            variant="outline"
            size="lg"
            className="w-full justify-start"
            onClick={() => onSelect(p.species!)}
          >
            {p.species}
          </Button>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
