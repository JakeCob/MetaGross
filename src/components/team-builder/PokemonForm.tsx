"use client";

import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SpeciesSearch } from "./SpeciesSearch";
import { MoveSelector } from "./MoveSelector";
import { EVEditor } from "./EVEditor";
import { ItemSelect } from "./ItemSelect";
import { EVSuggestionsPanel } from "./EVSuggestionsPanel";
import { EVDebatePanel } from "@/components/ev/EVDebatePanel";
import { UsageQuickView } from "@/components/meta/UsageQuickView";
import type { SpeciesData } from "@/lib/pokemon/species";
import type { AbilityData } from "@/lib/pokemon/abilities";
import type { TeamPokemon, EVSpread, IVSpread, StatName } from "@/lib/types/pokemon";
import { DEFAULT_EVS, DEFAULT_IVS } from "@/lib/types/pokemon";

const TYPE_COLORS: Record<string, string> = {
  Normal: "bg-gray-500 text-white",
  Fire: "bg-orange-600 text-white",
  Water: "bg-blue-500 text-white",
  Electric: "bg-yellow-400 text-black",
  Grass: "bg-green-500 text-white",
  Ice: "bg-cyan-300 text-black",
  Fighting: "bg-red-700 text-white",
  Poison: "bg-purple-600 text-white",
  Ground: "bg-amber-700 text-white",
  Flying: "bg-indigo-300 text-black",
  Psychic: "bg-pink-500 text-white",
  Bug: "bg-lime-600 text-white",
  Rock: "bg-yellow-800 text-white",
  Ghost: "bg-purple-800 text-white",
  Dragon: "bg-violet-700 text-white",
  Dark: "bg-gray-800 text-white",
  Steel: "bg-gray-400 text-black",
  Fairy: "bg-pink-300 text-black",
};

const NATURES: { name: string; label: string }[] = [
  { name: "Hardy", label: "Hardy (neutral)" },
  { name: "Lonely", label: "Lonely (+Atk/-Def)" },
  { name: "Brave", label: "Brave (+Atk/-Spe)" },
  { name: "Adamant", label: "Adamant (+Atk/-SpA)" },
  { name: "Naughty", label: "Naughty (+Atk/-SpD)" },
  { name: "Bold", label: "Bold (+Def/-Atk)" },
  { name: "Docile", label: "Docile (neutral)" },
  { name: "Relaxed", label: "Relaxed (+Def/-Spe)" },
  { name: "Impish", label: "Impish (+Def/-SpA)" },
  { name: "Lax", label: "Lax (+Def/-SpD)" },
  { name: "Timid", label: "Timid (+Spe/-Atk)" },
  { name: "Hasty", label: "Hasty (+Spe/-Def)" },
  { name: "Serious", label: "Serious (neutral)" },
  { name: "Jolly", label: "Jolly (+Spe/-SpA)" },
  { name: "Naive", label: "Naive (+Spe/-SpD)" },
  { name: "Modest", label: "Modest (+SpA/-Atk)" },
  { name: "Mild", label: "Mild (+SpA/-Def)" },
  { name: "Quiet", label: "Quiet (+SpA/-Spe)" },
  { name: "Bashful", label: "Bashful (neutral)" },
  { name: "Rash", label: "Rash (+SpA/-SpD)" },
  { name: "Calm", label: "Calm (+SpD/-Atk)" },
  { name: "Gentle", label: "Gentle (+SpD/-Def)" },
  { name: "Sassy", label: "Sassy (+SpD/-Spe)" },
  { name: "Careful", label: "Careful (+SpD/-SpA)" },
  { name: "Quirky", label: "Quirky (neutral)" },
];

const STAT_LABELS: { key: StatName; label: string }[] = [
  { key: "hp", label: "HP" },
  { key: "atk", label: "Atk" },
  { key: "def", label: "Def" },
  { key: "spa", label: "SpA" },
  { key: "spd", label: "SpD" },
  { key: "spe", label: "Spe" },
];

/** Returns point system limits based on the selected format. */
function getPointSystem(format: string): { totalMax: number; perStatMax: number; label: string } {
  if (format.toLowerCase().startsWith("champions")) {
    return { totalMax: 66, perStatMax: 32, label: "Points" };
  }
  return { totalMax: 510, perStatMax: 252, label: "EVs" };
}

export interface PokemonFormProps {
  value: Partial<TeamPokemon>;
  onChange: (pokemon: Partial<TeamPokemon>) => void;
  slot: number;
  format?: string;
  /** Full team (all 6 slots) — used by the AI EV optimizer for team context. */
  team?: Partial<TeamPokemon>[];
}

export function PokemonForm({ value, onChange, slot, format = "", team = [] }: PokemonFormProps) {
  const pointSystem = getPointSystem(format);
  const isChampions = format.toLowerCase().startsWith("champions");
  const [speciesData, setSpeciesData] = useState<SpeciesData | null>(null);
  const [abilities, setAbilities] = useState<string[]>([]);

  // Load species data when value.species changes (e.g., from import)
  useEffect(() => {
    if (!value.species) {
      setSpeciesData(null);
      setAbilities([]);
      return;
    }

    let cancelled = false;

    Promise.all([
      fetch(`/api/pokemon/${encodeURIComponent(value.species)}`).then((r) => r.json()),
      fetch(`/api/pokemon/abilities?species=${encodeURIComponent(value.species)}`).then((r) => r.json()),
    ]).then(([specData, abilityList]: [SpeciesData | null, AbilityData[]]) => {
      if (cancelled) return;
      if (specData && 'name' in specData) {
        setSpeciesData(specData);
        setAbilities(abilityList.map((a) => a.name));
      }
    }).catch(() => {
      if (!cancelled) {
        setSpeciesData(null);
        setAbilities([]);
      }
    });

    return () => { cancelled = true; };
  }, [value.species]);

  const handleSpeciesSelect = useCallback(
    (species: SpeciesData) => {
      setSpeciesData(species);

      // Fetch abilities for the selected species via API
      fetch(`/api/pokemon/abilities?species=${encodeURIComponent(species.name)}`)
        .then((r) => r.json())
        .then((abilityList: AbilityData[]) => {
          const abilityNames = abilityList.map((a) => a.name);
          setAbilities(abilityNames);

          onChange({
            ...value,
            species: species.name,
            ability: abilityNames[0] ?? "",
            moves: value.moves ?? ["", "", "", ""],
            evs: value.evs ?? { ...DEFAULT_EVS },
            ivs: value.ivs ?? { ...DEFAULT_IVS },
            nature: value.nature ?? "Hardy",
            level: value.level ?? 50,
            item: value.item ?? "",
          });
        })
        .catch(() => {
          setAbilities([]);
          onChange({
            ...value,
            species: species.name,
            ability: "",
            moves: value.moves ?? ["", "", "", ""],
            evs: value.evs ?? { ...DEFAULT_EVS },
            ivs: value.ivs ?? { ...DEFAULT_IVS },
            nature: value.nature ?? "Hardy",
            level: value.level ?? 50,
            item: value.item ?? "",
          });
        });
    },
    [value, onChange],
  );

  const update = useCallback(
    (fields: Partial<TeamPokemon>) => {
      onChange({ ...value, ...fields });
    },
    [value, onChange],
  );

  const currentEvs = value.evs ?? { ...DEFAULT_EVS };
  const currentIvs = value.ivs ?? { ...DEFAULT_IVS };
  const currentMoves = value.moves ?? ["", "", "", ""] as [string, string, string, string];
  const currentNature = value.nature ?? "Hardy";
  const currentLevel = value.level ?? 50;

  return (
    <div className="flex flex-col gap-6">
      {/* Pokemon Search */}
      <div>
        <div className="text-sm font-medium text-foreground mb-1.5">
          Pokemon
        </div>
        {value.species && speciesData ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
            <span className="font-medium text-foreground">
              {speciesData.name}
            </span>
            <div className="flex gap-1">
              {speciesData.types.map((type) => (
                <Badge
                  key={type}
                  className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[type] ?? "bg-gray-600 text-white"}`}
                >
                  {type}
                </Badge>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setSpeciesData(null);
                setAbilities([]);
                onChange({
                  ...value,
                  species: "",
                  ability: "",
                });
              }}
              className="ml-auto text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            >
              Change
            </button>
          </div>
        ) : (
          <SpeciesSearch
            onChange={handleSpeciesSelect}
            placeholder="Search Pokemon..."
            format={format}
          />
        )}
      </div>

      {speciesData && (
        <>
          {/* Base Stats Display */}
          <div className="flex gap-2 flex-wrap">
            {STAT_LABELS.map(({ key, label }) => (
              <div
                key={key}
                className="flex flex-col items-center rounded-lg border border-border bg-card px-3 py-1.5"
              >
                <span className="text-[10px] text-muted-foreground">{label}</span>
                <span className="text-sm font-mono font-medium text-foreground">
                  {speciesData.baseStats[key]}
                </span>
              </div>
            ))}
            <div className="flex flex-col items-center rounded-lg border border-border bg-card px-3 py-1.5">
              <span className="text-[10px] text-muted-foreground">BST</span>
              <span className="text-sm font-mono font-medium text-primary">
                {Object.values(speciesData.baseStats).reduce((a, b) => a + b, 0)}
              </span>
            </div>
          </div>

          {/* Meta Usage Quick View */}
          <UsageQuickView species={value.species ?? ""} />

          {/* Ability, Item, Nature, Level Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Ability</Label>
              <Select value={value.ability ?? ""} onValueChange={(val: string | null) => { if (val) update({ ability: val }); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {abilities.map((ability) => (
                    <SelectItem key={ability} value={ability}>
                      {ability}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Item</Label>
              <ItemSelect
                value={value.item ?? ""}
                onChange={(item) => update({ item })}
                championsOnly={isChampions}
                placeholder="e.g., Choice Band"
              />
              {isChampions && (
                <span className="text-[10px] text-muted-foreground">
                  Only Champions-legal items are suggested. Mega Stones enable Mega Evolution.
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Nature</Label>
              <Select value={currentNature} onValueChange={(val: string | null) => { if (val) update({ nature: val }); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NATURES.map((n) => (
                    <SelectItem key={n.name} value={n.name}>
                      {n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Level</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={currentLevel}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) update({ level: Math.max(1, Math.min(100, v)) });
                }}
              />
            </div>
          </div>

          {/* Moves */}
          <MoveSelector
            species={value.species ?? ""}
            value={currentMoves}
            onChange={(moves) => update({ moves })}
            championsOnly={isChampions}
          />

          {/* EVs / Points */}
          <EVEditor
            species={value.species ?? ""}
            baseStats={speciesData.baseStats}
            nature={currentNature}
            level={currentLevel}
            value={currentEvs}
            ivs={currentIvs}
            onChange={(evs) => update({ evs })}
            totalMax={pointSystem.totalMax}
            perStatMax={pointSystem.perStatMax}
            label={pointSystem.label}
          />

          {/* EV Suggestions */}
          <EVSuggestionsPanel
            pokemon={{
              species: value.species ?? "",
              ability: value.ability ?? "",
              item: value.item ?? "",
              nature: currentNature,
              level: currentLevel,
              moves: currentMoves,
              evs: currentEvs,
              ivs: currentIvs,
            }}
            onApplySpread={(evs, nature) => {
              update({ evs, nature });
            }}
          />

          {/* AI EV Debate Optimizer */}
          {value.species && currentMoves.some(Boolean) && (
            <EVDebatePanel
              pokemon={{
                species: value.species ?? "",
                ability: value.ability ?? "",
                item: value.item ?? "",
                nature: currentNature,
                level: currentLevel,
                moves: currentMoves,
                evs: currentEvs,
                ivs: currentIvs,
              }}
              team={
                team
                  .filter(
                    (t): t is TeamPokemon =>
                      Boolean(t.species) && t.species !== value.species,
                  )
              }
              format={format}
              onComplete={(evs, nature, full) => {
                if (full) {
                  const paddedMoves = [
                    ...full.moves,
                    "",
                    "",
                    "",
                    "",
                  ].slice(0, 4) as [string, string, string, string];
                  update({
                    evs: full.spread,
                    nature: full.nature,
                    moves: paddedMoves,
                    ability: full.ability || value.ability,
                    item: full.item || value.item,
                  });
                } else {
                  update({ evs, nature });
                }
              }}
            />
          )}

          {/* IVs — hidden in Champions (fixed at 31) */}
          {isChampions ? (
            <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
              <span className="text-[11px] text-muted-foreground">
                IVs are fixed at 31 in Champions Reg M-A — no manual editing required.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="text-sm font-medium text-foreground">IVs</div>
              <div className="grid grid-cols-6 gap-2">
                {STAT_LABELS.map(({ key, label }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground text-center">
                      {label}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={31}
                      value={currentIvs[key]}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v)) {
                          update({
                            ivs: {
                              ...currentIvs,
                              [key]: Math.max(0, Math.min(31, v)),
                            },
                          });
                        }
                      }}
                      className="h-8 w-full rounded-lg border border-border bg-card px-2 text-center text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
