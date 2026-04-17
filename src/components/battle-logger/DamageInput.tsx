"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { BoostableStat, StatusCondition } from "@/lib/types/battle";

export interface StatChangeDraft {
  stat: BoostableStat;
  delta: number;
}

export interface DamageInputResult {
  damage: number;
  wasCrit: boolean;
  wasKo: boolean;
  wasMiss: boolean;
  causedFlinch: boolean;
  inflictedStatus: StatusCondition | null;
  removedItem: boolean;
  /** Stat changes to apply to the target (defender). */
  targetStatChanges: StatChangeDraft[];
  /** Stat changes to apply to the attacker (self-boost / self-drop). */
  selfStatChanges: StatChangeDraft[];
}

export interface DamageSuggestion {
  minPercent: number;
  maxPercent: number;
  /** One-line summary from @smogon/calc for context (optional). */
  description?: string;
}

export interface DamageInputProps {
  targetName: string;
  /** Move name — used to pre-fill the status dropdown for moves that
   *  always inflict a specific status (Thunder Wave, Will-O-Wisp, …). */
  moveName?: string;
  /** Damage range computed by @smogon/calc — shows as a tap-to-apply chip. */
  suggestedDamage?: DamageSuggestion | null;
  onConfirm: (result: DamageInputResult) => void;
  onCancel: () => void;
}

/**
 * Moves that always inflict a specific status on the target when they
 * hit. Saves the user from manually picking the status every time.
 */
const GUARANTEED_STATUS: Record<string, StatusCondition> = {
  "Thunder Wave": "paralysis",
  "Stun Spore": "paralysis",
  "Glare": "paralysis",
  "Nuzzle": "paralysis",
  "Will-O-Wisp": "burn",
  "Inferno": "burn",
  "Spore": "sleep",
  "Sleep Powder": "sleep",
  "Hypnosis": "sleep",
  "Dark Void": "sleep",
  "Lovely Kiss": "sleep",
  "Sing": "sleep",
  "Grass Whistle": "sleep",
  "Yawn": "sleep",
  "Toxic": "toxic",
  "Poison Powder": "poison",
  "Poison Gas": "poison",
  "Confuse Ray": "confusion",
  "Supersonic": "confusion",
  "Swagger": "confusion",
  "Teeter Dance": "confusion",
};

function defaultStatusFor(moveName?: string): StatusCondition | "none" {
  if (!moveName) return "none";
  return GUARANTEED_STATUS[moveName] ?? "none";
}

/**
 * Pick the default damage value shown on the slider. When the caller
 * provides a calc-based suggestion, anchor to the midpoint so the chip
 * and the slider start in the same spot.
 */
function defaultDamage(suggestion?: DamageSuggestion | null): number {
  if (!suggestion) return 50;
  const mid = Math.round((suggestion.minPercent + suggestion.maxPercent) / 2);
  return Math.max(0, Math.min(100, mid));
}

const PRESETS = [25, 50, 75] as const;

const STATUS_OPTIONS: Array<{ value: StatusCondition | "none"; label: string }> = [
  { value: "none", label: "None" },
  { value: "paralysis", label: "Paralyzed (PAR)" },
  { value: "burn", label: "Burned (BRN)" },
  { value: "sleep", label: "Asleep (SLP)" },
  { value: "freeze", label: "Frozen (FRZ)" },
  { value: "poison", label: "Poisoned (PSN)" },
  { value: "toxic", label: "Badly poisoned (TOX)" },
  { value: "confusion", label: "Confused (CONF)" },
];

export function DamageInput({
  targetName,
  moveName,
  suggestedDamage,
  onConfirm,
  onCancel,
}: DamageInputProps) {
  const [damage, setDamage] = useState(() => defaultDamage(suggestedDamage));
  const [isCrit, setIsCrit] = useState(false);
  const [isKo, setIsKo] = useState(false);
  const [isMiss, setIsMiss] = useState(false);
  const [causedFlinch, setCausedFlinch] = useState(false);
  const [status, setStatus] = useState<StatusCondition | "none">(
    () => defaultStatusFor(moveName),
  );
  const [removedItem, setRemovedItem] = useState(false);
  const [targetStatChanges, setTargetStatChanges] = useState<StatChangeDraft[]>([]);
  const [selfStatChanges, setSelfStatChanges] = useState<StatChangeDraft[]>([]);

  const handleKoToggle = () => {
    const next = !isKo;
    setIsKo(next);
    if (next) {
      setDamage(100);
      setIsMiss(false);
    }
  };

  const handleMissToggle = () => {
    const next = !isMiss;
    setIsMiss(next);
    if (next) {
      setDamage(0);
      setIsKo(false);
      setIsCrit(false);
      setCausedFlinch(false);
      setStatus("none");
    }
  };

  const handleConfirm = () => {
    onConfirm({
      damage: isMiss ? 0 : damage,
      wasCrit: !isMiss && isCrit,
      wasKo: !isMiss && isKo,
      wasMiss: isMiss,
      causedFlinch: !isMiss && causedFlinch,
      inflictedStatus: isMiss ? null : status === "none" ? null : status,
      removedItem: !isMiss && removedItem,
      targetStatChanges: isMiss ? [] : targetStatChanges,
      selfStatChanges,
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Result against <span className="font-medium text-foreground">{targetName}</span>
      </p>

      {/* Calc suggestion chip — tap to apply */}
      {suggestedDamage && !isMiss && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1.5">
          <span className="text-[10px] uppercase tracking-wider text-primary">
            Calc says
          </span>
          <span className="text-sm font-mono font-medium text-foreground">
            {suggestedDamage.minPercent.toFixed(0)}–
            {suggestedDamage.maxPercent.toFixed(0)}%
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 text-[10px] ml-auto"
            onClick={() => {
              const mid = Math.round(
                (suggestedDamage.minPercent + suggestedDamage.maxPercent) / 2,
              );
              setDamage(Math.max(0, Math.min(100, mid)));
              if (suggestedDamage.maxPercent < 100 && isKo) setIsKo(false);
            }}
            title={suggestedDamage.description}
          >
            Use midpoint
          </Button>
        </div>
      )}

      {/* Damage slider */}
      <div className={`flex flex-col gap-1.5 ${isMiss ? "opacity-40 pointer-events-none" : ""}`}>
        <Label htmlFor="damage-range">Damage ({damage}%)</Label>
        <input
          id="damage-range"
          type="range"
          min={0}
          max={100}
          step={1}
          value={damage}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (Number.isNaN(v)) return;
            setDamage(v);
            if (v < 100 && isKo) setIsKo(false);
          }}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        />
      </div>

      {/* Preset buttons */}
      <div className={`flex gap-2 ${isMiss ? "opacity-40 pointer-events-none" : ""}`}>
        {PRESETS.map((p) => (
          <Button
            key={p}
            variant={damage === p ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => {
              setDamage(p);
              if (p < 100 && isKo) setIsKo(false);
            }}
          >
            {p}%
          </Button>
        ))}
      </div>

      {/* Main toggles */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={isMiss ? "destructive" : "outline"}
          size="sm"
          onClick={handleMissToggle}
        >
          {isMiss ? "✗ Missed" : "Missed / blocked"}
        </Button>
        <Button
          variant={isKo ? "destructive" : "outline"}
          size="sm"
          disabled={isMiss}
          onClick={handleKoToggle}
        >
          KO
        </Button>
        <Button
          variant={isCrit ? "default" : "outline"}
          size="sm"
          disabled={isMiss}
          onClick={() => setIsCrit(!isCrit)}
        >
          Crit
        </Button>
        <Button
          variant={causedFlinch ? "default" : "outline"}
          size="sm"
          disabled={isMiss}
          onClick={() => setCausedFlinch(!causedFlinch)}
        >
          Flinch
        </Button>
      </div>

      {/* Status inflicted */}
      <div className={`flex flex-col gap-1 ${isMiss ? "opacity-40 pointer-events-none" : ""}`}>
        <Label htmlFor="inflicted-status" className="text-[11px]">
          Status inflicted on target
        </Label>
        <select
          id="inflicted-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusCondition | "none")}
          className="h-8 rounded-lg border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Item / stat side-effects */}
      <div className={`flex flex-col gap-2 ${isMiss ? "opacity-40 pointer-events-none" : ""}`}>
        <Label className="text-[11px]">Side effects</Label>
        <Button
          type="button"
          variant={removedItem ? "default" : "outline"}
          size="sm"
          className="text-xs"
          onClick={() => setRemovedItem(!removedItem)}
        >
          {removedItem ? "✓ Item knocked off" : "Knocked off / stole item"}
        </Button>

        <StatChangeRow
          label="Target stat change"
          value={targetStatChanges}
          onChange={setTargetStatChanges}
        />
        <StatChangeRow
          label="Self stat change"
          value={selfStatChanges}
          onChange={setSelfStatChanges}
        />
      </div>

      {/* Confirm / Cancel */}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" className="flex-1" onClick={handleConfirm}>
          Confirm
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline stat-change editor: add rows of { stat, delta }. Kept compact so
// it fits inside the damage dialog without dominating the UI.
// ---------------------------------------------------------------------------
const STAT_OPTIONS: BoostableStat[] = ["atk", "def", "spa", "spd", "spe", "accuracy", "evasion"];

function StatChangeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: StatChangeDraft[];
  onChange: (next: StatChangeDraft[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {value.map((row, i) => (
        <div key={i} className="flex items-center gap-1">
          <select
            value={row.stat}
            onChange={(e) => {
              const next = [...value];
              next[i] = { ...row, stat: e.target.value as BoostableStat };
              onChange(next);
            }}
            className="h-7 rounded border border-border bg-card px-1.5 text-[11px]"
          >
            {STAT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            value={row.delta}
            onChange={(e) => {
              const next = [...value];
              next[i] = { ...row, delta: parseInt(e.target.value, 10) };
              onChange(next);
            }}
            className="h-7 rounded border border-border bg-card px-1.5 text-[11px]"
          >
            {[-6, -3, -2, -1, 1, 2, 3, 6].map((d) => (
              <option key={d} value={d}>
                {d > 0 ? `+${d}` : d}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            aria-label="Remove stat change"
            title="Remove"
          >
            ×
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-[11px] self-start"
        onClick={() => onChange([...value, { stat: "atk", delta: -1 }])}
      >
        + Add {label.toLowerCase()}
      </Button>
    </div>
  );
}
