"use client";

import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SpeciesSearch } from "./SpeciesSearch";
import { MoveSelector } from "./MoveSelector";
import { EVEditor } from "./EVEditor";
import { getSpecies, type SpeciesData } from "@/lib/pokemon/species";
import { getAbilitiesForSpecies } from "@/lib/pokemon/abilities";
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

export interface PokemonFormProps {
  value: Partial<TeamPokemon>;
  onChange: (pokemon: Partial<TeamPokemon>) => void;
  slot: number;
}

export function PokemonForm({ value, onChange, slot }: PokemonFormProps) {
  const [speciesData, setSpeciesData] = useState<SpeciesData | null>(null);
  const [abilities, setAbilities] = useState<string[]>([]);

  // Load species data when value.species changes (e.g., from import)
  useEffect(() => {
    if (value.species) {
      const data = getSpecies(value.species);
      if (data) {
        setSpeciesData(data);
        const abilityList = getAbilitiesForSpecies(value.species);
        setAbilities(abilityList.map((a) => a.name));
      }
    } else {
      setSpeciesData(null);
      setAbilities([]);
    }
  }, [value.species]);

  const handleSpeciesSelect = useCallback(
    (species: SpeciesData) => {
      const abilityList = getAbilitiesForSpecies(species.name);
      const abilityNames = abilityList.map((a) => a.name);
      setSpeciesData(species);
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
      {/* Species Search */}
      <div>
        <div className="text-sm font-medium text-foreground mb-1.5">
          Species
        </div>
        {value.species && speciesData ? (
          <div className="flex items-center gap-3 rounded-lg border border-card-border bg-card px-4 py-2.5">
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
              className="ml-auto text-xs text-muted hover:text-destructive transition-colors cursor-pointer"
            >
              Change
            </button>
          </div>
        ) : (
          <SpeciesSearch
            onChange={handleSpeciesSelect}
            placeholder={`Search Pokemon for Slot ${slot}...`}
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
                className="flex flex-col items-center rounded-lg border border-card-border bg-card px-3 py-1.5"
              >
                <span className="text-[10px] text-muted">{label}</span>
                <span className="text-sm font-mono font-medium text-foreground">
                  {speciesData.baseStats[key]}
                </span>
              </div>
            ))}
            <div className="flex flex-col items-center rounded-lg border border-card-border bg-card px-3 py-1.5">
              <span className="text-[10px] text-muted">BST</span>
              <span className="text-sm font-mono font-medium text-accent">
                {Object.values(speciesData.baseStats).reduce((a, b) => a + b, 0)}
              </span>
            </div>
          </div>

          {/* Ability, Item, Nature, Level Row */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Ability"
              value={value.ability ?? ""}
              onChange={(e) => update({ ability: e.target.value })}
            >
              {abilities.map((ability) => (
                <option key={ability} value={ability}>
                  {ability}
                </option>
              ))}
            </Select>

            <Input
              label="Item"
              value={value.item ?? ""}
              onChange={(e) => update({ item: e.target.value })}
              placeholder="e.g., Choice Band"
            />

            <Select
              label="Nature"
              value={currentNature}
              onChange={(e) => update({ nature: e.target.value })}
            >
              {NATURES.map((n) => (
                <option key={n.name} value={n.name}>
                  {n.label}
                </option>
              ))}
            </Select>

            <Input
              label="Level"
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

          {/* Moves */}
          <MoveSelector
            species={value.species ?? ""}
            value={currentMoves}
            onChange={(moves) => update({ moves })}
          />

          {/* EVs */}
          <EVEditor
            species={value.species ?? ""}
            baseStats={speciesData.baseStats}
            nature={currentNature}
            level={currentLevel}
            value={currentEvs}
            ivs={currentIvs}
            onChange={(evs) => update({ evs })}
          />

          {/* IVs */}
          <div className="flex flex-col gap-3">
            <div className="text-sm font-medium text-foreground">IVs</div>
            <div className="grid grid-cols-6 gap-2">
              {STAT_LABELS.map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-1">
                  <span className="text-[10px] text-muted text-center">
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
                    className="h-8 w-full rounded-lg border border-card-border bg-card px-2 text-center text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
