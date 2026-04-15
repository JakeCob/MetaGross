"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export interface DamageInputProps {
  targetName: string;
  onConfirm: (damage: number, wasCrit: boolean, wasKo: boolean) => void;
  onCancel: () => void;
}

const PRESETS = [25, 50, 75] as const;

export function DamageInput({
  targetName,
  onConfirm,
  onCancel,
}: DamageInputProps) {
  const [damage, setDamage] = useState(50);
  const [isCrit, setIsCrit] = useState(false);
  const [isKo, setIsKo] = useState(false);

  const handleKoToggle = () => {
    const newKo = !isKo;
    setIsKo(newKo);
    if (newKo) {
      setDamage(100);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Damage to <span className="font-medium text-foreground">{targetName}</span>
      </p>

      {/* Native range input — replaces Base UI Slider, which emitted a
          dev-only "script tag in React component" warning in v1.x. */}
      <div className="flex flex-col gap-1.5">
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
      <div className="flex gap-2">
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

      {/* Toggles */}
      <div className="flex gap-2">
        <Button
          variant={isKo ? "destructive" : "outline"}
          size="sm"
          className="flex-1"
          onClick={handleKoToggle}
        >
          KO
        </Button>
        <Button
          variant={isCrit ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setIsCrit(!isCrit)}
        >
          Crit
        </Button>
      </div>

      {/* Confirm / Cancel */}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" className="flex-1" onClick={() => onConfirm(damage, isCrit, isKo)}>
          Confirm
        </Button>
      </div>
    </div>
  );
}
