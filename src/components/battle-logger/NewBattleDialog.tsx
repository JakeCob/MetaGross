"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { BattleMode } from "@/lib/types/battle";

const modes: {
  mode: BattleMode;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    mode: "realtime",
    title: "Real-Time",
    description:
      "Log turns as they happen during a live battle. Best for detailed analysis.",
    icon: "\u23F1",
  },
  {
    mode: "postmatch",
    title: "Post-Match",
    description:
      "Record details after the battle ends. Great for replay reviews.",
    icon: "\u270D",
  },
  {
    mode: "quick",
    title: "Quick Log",
    description:
      "Just record teams, leads, and the result. Fast and simple.",
    icon: "\u26A1",
  },
];

export interface NewBattleDialogProps {
  onSelect: (mode: BattleMode) => void;
}

export function NewBattleDialog({ onSelect }: NewBattleDialogProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-foreground">
          Choose Logging Mode
        </h2>
        <p className="mt-1 text-sm text-muted">
          How would you like to log this battle?
        </p>
      </div>

      <div className="grid gap-3">
        {modes.map(({ mode, title, description, icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            className="cursor-pointer text-left"
          >
            <Card className="transition-all hover:border-accent/50 hover:bg-card-border/10">
              <CardContent className="flex items-start gap-4">
                <span className="text-2xl mt-0.5">{icon}</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="mt-0.5 text-sm text-muted">{description}</p>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted mt-1 shrink-0"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
