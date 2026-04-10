"use client";

import { Button } from "@/components/ui/button";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { Slot } from "@/lib/types/battle";

export interface SwitchPanelProps {
  benchPokemon: TeamPokemon[];
  slot: Slot;
  onSelect: (species: string) => void;
  onCancel: () => void;
}

export function SwitchPanel({
  benchPokemon,
  slot,
  onSelect,
  onCancel,
}: SwitchPanelProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-t-2xl border border-card-border bg-card p-4 pb-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Switch In (Slot {slot})
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Select a bench Pokemon to switch in
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

        {benchPokemon.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted">No bench Pokemon available.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {benchPokemon.map((mon) => (
              <Button
                key={mon.species}
                variant="outline"
                size="lg"
                className="w-full justify-start gap-3 min-h-[52px]"
                onClick={() => onSelect(mon.species)}
              >
                <span className="font-semibold">{mon.species}</span>
                {mon.item && (
                  <span className="text-xs text-muted">@ {mon.item}</span>
                )}
              </Button>
            ))}
          </div>
        )}

        <Button variant="ghost" size="sm" className="w-full" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
