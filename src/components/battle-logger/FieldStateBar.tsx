"use client";

import type { FieldState } from "@/lib/types/battle";

const WEATHER_OPTIONS: { value: FieldState["weather"]; label: string }[] = [
  { value: null, label: "Clear" },
  { value: "sun", label: "Sun" },
  { value: "rain", label: "Rain" },
  { value: "sand", label: "Sand" },
  { value: "snow", label: "Snow" },
];

const TERRAIN_OPTIONS: { value: FieldState["terrain"]; label: string }[] = [
  { value: null, label: "None" },
  { value: "electric", label: "Elec" },
  { value: "grassy", label: "Grass" },
  { value: "misty", label: "Misty" },
  { value: "psychic", label: "Psych" },
];

export interface FieldStateBarProps {
  fieldState: FieldState;
  onChange: (updates: Partial<FieldState>) => void;
}

function ToggleChip({
  label,
  active,
  onClick,
  color = "accent",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: "accent" | "warning" | "info";
}) {
  const colorMap = {
    accent: active
      ? "bg-accent/20 text-primary border-primary/40"
      : "bg-card text-muted-foreground border-border hover:border-muted",
    warning: active
      ? "bg-warning/20 text-warning border-warning/40"
      : "bg-card text-muted-foreground border-border hover:border-muted",
    info: active
      ? "bg-info/20 text-info border-info/40"
      : "bg-card text-muted-foreground border-border hover:border-muted",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${colorMap[color]}`}
    >
      {label}
    </button>
  );
}

export function FieldStateBar({ fieldState, onChange }: FieldStateBarProps) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      {/* Weather row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground w-12 shrink-0">
          Weath
        </span>
        {WEATHER_OPTIONS.map((opt) => (
          <ToggleChip
            key={opt.label}
            label={opt.label}
            active={fieldState.weather === opt.value}
            onClick={() => onChange({ weather: opt.value })}
            color="warning"
          />
        ))}
      </div>

      {/* Terrain row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground w-12 shrink-0">
          Terra
        </span>
        {TERRAIN_OPTIONS.map((opt) => (
          <ToggleChip
            key={opt.label}
            label={opt.label}
            active={fieldState.terrain === opt.value}
            onClick={() => onChange({ terrain: opt.value })}
            color="info"
          />
        ))}
      </div>

      {/* Trick Room + Tailwind */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground w-12 shrink-0">
          Buffs
        </span>
        <ToggleChip
          label="Trick Room"
          active={fieldState.trickRoom}
          onClick={() => onChange({ trickRoom: !fieldState.trickRoom })}
          color="warning"
        />
        <ToggleChip
          label="TW (Me)"
          active={fieldState.tailwindP1}
          onClick={() => onChange({ tailwindP1: !fieldState.tailwindP1 })}
          color="accent"
        />
        <ToggleChip
          label="TW (Opp)"
          active={fieldState.tailwindP2}
          onClick={() => onChange({ tailwindP2: !fieldState.tailwindP2 })}
          color="accent"
        />
      </div>
    </div>
  );
}
