"use client";

import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { EVSpread, IVSpread, StatName } from "@/lib/types/pokemon";
import { MAX_TOTAL_EVS, MAX_SINGLE_EV } from "@/lib/types/pokemon";
import { calcStat } from "@/lib/pokemon/stats";
import { CHAMPIONS_POINTS } from "@/lib/data/champions";

// Maps each nature to the stat it boosts (+10%) and reduces (-10%).
const NATURE_EFFECTS: Record<string, { plus?: StatName; minus?: StatName }> = {
  Hardy: {}, Docile: {}, Serious: {}, Bashful: {}, Quirky: {},
  Lonely: { plus: "atk", minus: "def" },
  Brave: { plus: "atk", minus: "spe" },
  Adamant: { plus: "atk", minus: "spa" },
  Naughty: { plus: "atk", minus: "spd" },
  Bold: { plus: "def", minus: "atk" },
  Relaxed: { plus: "def", minus: "spe" },
  Impish: { plus: "def", minus: "spa" },
  Lax: { plus: "def", minus: "spd" },
  Modest: { plus: "spa", minus: "atk" },
  Mild: { plus: "spa", minus: "def" },
  Quiet: { plus: "spa", minus: "spe" },
  Rash: { plus: "spa", minus: "spd" },
  Calm: { plus: "spd", minus: "atk" },
  Gentle: { plus: "spd", minus: "def" },
  Sassy: { plus: "spd", minus: "spe" },
  Careful: { plus: "spd", minus: "spa" },
  Timid: { plus: "spe", minus: "atk" },
  Hasty: { plus: "spe", minus: "def" },
  Jolly: { plus: "spe", minus: "spa" },
  Naive: { plus: "spe", minus: "spd" },
};

function getNatureMark(stat: StatName, nature: string): "plus" | "minus" | null {
  const eff = NATURE_EFFECTS[nature];
  if (!eff) return null;
  if (eff.plus === stat) return "plus";
  if (eff.minus === stat) return "minus";
  return null;
}

const STAT_LABELS: { key: StatName; label: string; short: string }[] = [
  { key: "hp", label: "HP", short: "HP" },
  { key: "atk", label: "Attack", short: "Atk" },
  { key: "def", label: "Defense", short: "Def" },
  { key: "spa", label: "Sp. Atk", short: "SpA" },
  { key: "spd", label: "Sp. Def", short: "SpD" },
  { key: "spe", label: "Speed", short: "Spe" },
];

interface EVPreset {
  name: string;
  evs: EVSpread;
}

const TRADITIONAL_PRESETS: EVPreset[] = [
  {
    name: "252/252/4 Physical",
    evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
  },
  {
    name: "252/252/4 Special",
    evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
  },
  {
    name: "Max HP/Def",
    evs: { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 },
  },
  {
    name: "Max HP/SpD",
    evs: { hp: 252, atk: 0, def: 0, spa: 0, spd: 252, spe: 4 },
  },
];

const CHAMPIONS_PRESETS: EVPreset[] = [
  {
    name: "32/32/2 Physical",
    evs: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
  },
  {
    name: "32/32/2 Special",
    evs: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 },
  },
  {
    name: "Max HP/Def",
    evs: { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 },
  },
  {
    name: "Max HP/SpD",
    evs: { hp: 32, atk: 0, def: 0, spa: 0, spd: 32, spe: 2 },
  },
];

export interface EVEditorProps {
  species: string;
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  nature: string;
  level: number;
  value: EVSpread;
  ivs: IVSpread;
  onChange: (evs: EVSpread) => void;
  /** Maximum total points across all stats (default 510 for traditional EVs, 66 for Champions). */
  totalMax?: number;
  /** Maximum points per individual stat (default 252 for traditional EVs, 32 for Champions). */
  perStatMax?: number;
  /** Display label: "EVs" or "Points" (default "EVs"). */
  label?: string;
}

export function EVEditor({
  species,
  baseStats,
  nature,
  level,
  value,
  ivs,
  onChange,
  totalMax = MAX_TOTAL_EVS,
  perStatMax = MAX_SINGLE_EV,
  label = "EVs",
}: EVEditorProps) {
  const total = useMemo(
    () => value.hp + value.atk + value.def + value.spa + value.spd + value.spe,
    [value],
  );

  const isOverLimit = total > totalMax;

  const presets = totalMax === 66 ? CHAMPIONS_PRESETS : TRADITIONAL_PRESETS;
  // For Champions, step by 1; for traditional EVs, step by 4
  const step = totalMax === 66 ? 1 : 4;

  const updateStat = useCallback(
    (stat: StatName, newVal: number) => {
      const clamped = Math.max(0, Math.min(perStatMax, newVal));
      onChange({ ...value, [stat]: clamped });
    },
    [value, onChange, perStatMax],
  );

  const incrementStat = useCallback(
    (stat: StatName, amount: number) => {
      const current = value[stat];
      const newVal = Math.max(0, Math.min(perStatMax, current + amount));
      onChange({ ...value, [stat]: newVal });
    },
    [value, onChange, perStatMax],
  );

  const applyPreset = useCallback(
    (preset: EVPreset) => {
      onChange({ ...preset.evs });
    },
    [onChange],
  );

  const resetAll = useCallback(() => {
    onChange({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
  }, [onChange]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">
          {label}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-sm font-mono ${isOverLimit ? "text-destructive font-bold" : "text-muted-foreground"}`}
          >
            {total}/{totalMax}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetAll}
            className="text-xs h-7 px-2"
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <Button
            key={preset.name}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset(preset)}
            className="text-xs h-7 px-2"
          >
            {preset.name}
          </Button>
        ))}
      </div>

      {/* Header row for stat sliders */}
      {species && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium border-b border-border/40 pb-1">
          <span className="w-8 text-right shrink-0">Stat</span>
          <span className="w-6 shrink-0" />
          <span className="flex-1 text-center">{label}</span>
          <span className="w-6 shrink-0" />
          <span className="w-8 text-right shrink-0">{label === "Points" ? "Pts" : "EVs"}</span>
          <span className="w-12 text-right shrink-0">Final</span>
        </div>
      )}

      {/* Stat sliders */}
      <div className="flex flex-col gap-3">
        {STAT_LABELS.map(({ key, short }) => {
          const evValue = value[key];
          // In Champions, the slider stores POINTS — convert to EVs (1 pt = 8 EVs) for stat math.
          const evForCalc =
            totalMax === 66
              ? Math.min(MAX_SINGLE_EV, evValue * CHAMPIONS_POINTS.evConversion)
              : evValue;
          const finalStat = species
            ? calcStat(key, baseStats[key], ivs[key], evForCalc, level, nature)
            : 0;
          const baseFinal = species
            ? calcStat(key, baseStats[key], ivs[key], 0, level, "Hardy")
            : 0;
          const natureMark = getNatureMark(key, nature);
          const finalColor =
            key === "hp"
              ? "text-primary"
              : natureMark === "plus"
                ? "text-emerald-400"
                : natureMark === "minus"
                  ? "text-rose-400"
                  : "text-primary";
          const delta = finalStat - baseFinal;

          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-8 text-xs font-medium text-muted-foreground text-right shrink-0">
                {short}
                {natureMark === "plus" && (
                  <span className="text-emerald-400 ml-0.5">+</span>
                )}
                {natureMark === "minus" && (
                  <span className="text-rose-400 ml-0.5">−</span>
                )}
              </span>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => incrementStat(key, -step)}
                className="h-6 w-6 p-0 text-xs shrink-0"
                disabled={evValue <= 0}
              >
                -
              </Button>

              <input
                type="range"
                min={0}
                max={perStatMax}
                step={step}
                value={evValue}
                onChange={(e) => updateStat(key, parseInt(e.target.value, 10))}
                className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-border accent-primary"
              />

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => incrementStat(key, step)}
                className="h-6 w-6 p-0 text-xs shrink-0"
                disabled={evValue >= perStatMax}
              >
                +
              </Button>

              <span className="w-8 text-xs font-mono text-foreground text-right shrink-0">
                {evValue}
              </span>

              {species && (
                <span
                  className={`w-12 text-xs font-mono text-right shrink-0 ${finalColor}`}
                  title={
                    key === "hp"
                      ? `Base HP ${baseStats[key]} → ${finalStat}`
                      : `Base ${baseStats[key]} → ${finalStat}${
                          natureMark === "plus"
                            ? " (+10% nature)"
                            : natureMark === "minus"
                              ? " (-10% nature)"
                              : ""
                        }${delta !== 0 ? `, +${delta} from EVs/nature` : ""}`
                  }
                >
                  {finalStat}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {isOverLimit && (
        <p className="text-xs text-destructive">
          Total {label} exceed the maximum of {totalMax}. Please reduce by{" "}
          {total - totalMax}.
        </p>
      )}
    </div>
  );
}
