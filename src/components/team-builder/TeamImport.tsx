"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { importTeamFromPaste } from "@/lib/pokemon/sets";
import type { TeamPokemon } from "@/lib/types/pokemon";

export interface TeamImportProps {
  onImport: (pokemon: TeamPokemon[]) => void;
}

export function TeamImport({ onImport }: TeamImportProps) {
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleImport = useCallback(() => {
    setError(null);

    if (!paste.trim()) {
      setError("Please paste a team in Showdown/PokePaste format.");
      return;
    }

    try {
      const pokemon = importTeamFromPaste(paste);

      if (pokemon.length === 0) {
        setError(
          "Could not parse any Pokemon from the paste. Make sure it is in Showdown export format.",
        );
        return;
      }

      onImport(pokemon);
      setPaste("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to parse team. Check the format and try again.",
      );
    }
  }, [paste, onImport]);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm font-medium text-foreground">
        Import from PokePaste
      </div>
      <p className="text-xs text-muted">
        Paste a team in Showdown export format. Each Pokemon should include
        species, ability, item, nature, moves, EVs, and IVs.
      </p>

      <textarea
        value={paste}
        onChange={(e) => {
          setPaste(e.target.value);
          if (error) setError(null);
        }}
        placeholder={`Metagross @ Choice Band\nAbility: Clear Body\nLevel: 50\nEVs: 252 Atk / 4 SpD / 252 Spe\nAdamant Nature\n- Iron Head\n- Zen Headbutt\n- Bullet Punch\n- Ice Punch`}
        rows={12}
        className="w-full rounded-lg border border-card-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-y font-mono"
      />

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="button" onClick={handleImport}>
          Import
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setPaste("");
            setError(null);
          }}
          disabled={!paste}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
