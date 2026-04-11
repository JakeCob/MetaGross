"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BattleResult as BattleResultType } from "@/lib/types/battle";

export interface BattleResultProps {
  opponentName: string;
  notes: string;
  onOpponentNameChange: (name: string) => void;
  onNotesChange: (notes: string) => void;
  onSave: (result: BattleResultType) => void;
  saving?: boolean;
}

export function BattleResult({
  opponentName,
  notes,
  onOpponentNameChange,
  onNotesChange,
  onSave,
  saving = false,
}: BattleResultProps) {
  const [selectedResult, setSelectedResult] =
    useState<BattleResultType | null>(null);

  const handleSave = useCallback(() => {
    if (selectedResult) {
      onSave(selectedResult);
    }
  }, [selectedResult, onSave]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Match Result</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Record the outcome of this battle.
        </p>
      </div>

      {/* Win / Loss buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setSelectedResult("win")}
          className={`cursor-pointer flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-8 text-center transition-all ${
            selectedResult === "win"
              ? "border-success bg-success/10 ring-2 ring-success/30"
              : "border-border bg-card hover:border-success/50"
          }`}
        >
          <span className="text-4xl">W</span>
          <span
            className={`text-lg font-bold ${
              selectedResult === "win" ? "text-success" : "text-foreground"
            }`}
          >
            WIN
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedResult("loss")}
          className={`cursor-pointer flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-8 text-center transition-all ${
            selectedResult === "loss"
              ? "border-destructive bg-destructive/10 ring-2 ring-destructive/30"
              : "border-border bg-card hover:border-destructive/50"
          }`}
        >
          <span className="text-4xl">L</span>
          <span
            className={`text-lg font-bold ${
              selectedResult === "loss" ? "text-destructive" : "text-foreground"
            }`}
          >
            LOSS
          </span>
        </button>
      </div>

      {/* Opponent name */}
      <div className="flex flex-col gap-1.5">
        <Label>Opponent Name</Label>
        <Input
          placeholder="Enter opponent's name (optional)"
          value={opponentName}
          onChange={(e) => onOpponentNameChange(e.target.value)}
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="battle-notes"
          className="text-sm font-medium text-foreground"
        >
          Notes
        </label>
        <textarea
          id="battle-notes"
          placeholder="Key plays, mistakes, observations... (optional)"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
        />
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={!selectedResult || saving}
          size="lg"
        >
          {saving ? "Saving..." : "Save Match"}
        </Button>
      </div>
    </div>
  );
}
