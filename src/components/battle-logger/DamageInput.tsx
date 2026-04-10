"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

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
      <p className="text-sm text-muted">
        Damage to <span className="font-medium text-foreground">{targetName}</span>
      </p>

      {/* Slider */}
      <Slider
        label="Damage"
        min={0}
        max={100}
        value={damage}
        onChange={(e) => {
          const val = Number(e.target.value);
          setDamage(val);
          if (val < 100 && isKo) setIsKo(false);
        }}
      />

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
