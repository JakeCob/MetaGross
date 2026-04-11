"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { TeamPokemon } from "@/lib/types/pokemon";

export interface TeamImportProps {
  onImport: (pokemon: TeamPokemon[]) => void;
}

export function TeamImport({ onImport }: TeamImportProps) {
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);

  const handleImport = useCallback(async () => {
    setError(null);

    if (!paste.trim()) {
      setError("Please paste a team in Showdown/PokePaste format.");
      return;
    }

    setImporting(true);
    try {
      const res = await fetch("/api/pokemon/parse-paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paste }),
      });

      if (!res.ok) {
        setError("Failed to parse team. Check the format and try again.");
        return;
      }

      const pokemon: TeamPokemon[] = await res.json();

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
    } finally {
      setImporting(false);
    }
  }, [paste, onImport]);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm font-medium text-foreground">
        Import from PokePaste
      </div>
      <p className="text-xs text-muted-foreground">
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
        className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y font-mono"
      />

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="button" onClick={handleImport} disabled={importing}>
          {importing ? "Importing..." : "Import"}
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
