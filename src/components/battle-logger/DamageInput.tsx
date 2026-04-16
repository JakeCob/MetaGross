"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { StatusCondition } from "@/lib/types/battle";

export interface DamageInputResult {
  damage: number;
  wasCrit: boolean;
  wasKo: boolean;
  wasMiss: boolean;
  causedFlinch: boolean;
  inflictedStatus: StatusCondition | null;
}

export interface DamageInputProps {
  targetName: string;
  onConfirm: (result: DamageInputResult) => void;
  onCancel: () => void;
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
  onConfirm,
  onCancel,
}: DamageInputProps) {
  const [damage, setDamage] = useState(50);
  const [isCrit, setIsCrit] = useState(false);
  const [isKo, setIsKo] = useState(false);
  const [isMiss, setIsMiss] = useState(false);
  const [causedFlinch, setCausedFlinch] = useState(false);
  const [status, setStatus] = useState<StatusCondition | "none">("none");

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
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Result against <span className="font-medium text-foreground">{targetName}</span>
      </p>

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
