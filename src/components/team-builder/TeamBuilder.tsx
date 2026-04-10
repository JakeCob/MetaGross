"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/tabs";
import { PokemonForm } from "./PokemonForm";
import { TeamImport } from "./TeamImport";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { DEFAULT_EVS, DEFAULT_IVS } from "@/lib/types/pokemon";
import { exportTeamToPaste } from "@/lib/pokemon/sets";

const FORMATS = [
  "VGC 2025 Reg H",
  "VGC 2025 Reg G",
  "VGC 2024 Reg F",
  "VGC 2024 Reg E",
  "Battle Stadium Singles",
  "Battle Stadium Doubles",
  "Other",
];

function emptyPokemon(): Partial<TeamPokemon> {
  return {
    species: "",
    ability: "",
    item: "",
    nature: "Hardy",
    level: 50,
    moves: ["", "", "", ""],
    evs: { ...DEFAULT_EVS },
    ivs: { ...DEFAULT_IVS },
  };
}

export interface TeamBuilderProps {
  teamId?: string;
}

export function TeamBuilder({ teamId }: TeamBuilderProps) {
  const router = useRouter();
  const isEditing = Boolean(teamId);

  const [teamName, setTeamName] = useState("");
  const [format, setFormat] = useState(FORMATS[0]);
  const [pokemon, setPokemon] = useState<Partial<TeamPokemon>[]>(() =>
    Array.from({ length: 6 }, () => emptyPokemon()),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Load existing team data when editing
  useEffect(() => {
    if (!teamId) return;

    let cancelled = false;
    setLoadingTeam(true);

    fetch(`/api/teams/${teamId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load team");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const team = data.team;
        setTeamName(team.name ?? "");
        setFormat(team.format ?? FORMATS[0]);

        // Map stored pokemon rows into form state
        const slots: Partial<TeamPokemon>[] = Array.from(
          { length: 6 },
          () => emptyPokemon(),
        );
        if (team.pokemon && Array.isArray(team.pokemon)) {
          for (let i = 0; i < Math.min(team.pokemon.length, 6); i++) {
            const mon = team.pokemon[i];
            const moves = Array.isArray(mon.moves)
              ? mon.moves
              : typeof mon.moves === "string"
                ? JSON.parse(mon.moves)
                : ["", "", "", ""];
            const evs =
              typeof mon.evs === "string"
                ? JSON.parse(mon.evs)
                : mon.evs ?? { ...DEFAULT_EVS };
            const ivs =
              typeof mon.ivs === "string"
                ? JSON.parse(mon.ivs)
                : mon.ivs ?? { ...DEFAULT_IVS };

            // Pad moves to 4
            while (moves.length < 4) moves.push("");

            slots[i] = {
              species: mon.species ?? "",
              ability: mon.ability ?? "",
              item: mon.item ?? "",
              nature: mon.nature ?? "Hardy",
              level: mon.level ?? 50,
              teraType: mon.teraType ?? undefined,
              moves: [moves[0], moves[1], moves[2], moves[3]] as [
                string,
                string,
                string,
                string,
              ],
              evs,
              ivs,
            };
          }
        }
        setPokemon(slots);
      })
      .catch((err) => {
        if (!cancelled) {
          setErrors([
            err instanceof Error ? err.message : "Failed to load team",
          ]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTeam(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const updateSlot = useCallback(
    (index: number, updated: Partial<TeamPokemon>) => {
      setPokemon((prev) => {
        const next = [...prev];
        next[index] = updated;
        return next;
      });
    },
    [],
  );

  const handleImport = useCallback((imported: TeamPokemon[]) => {
    const slots: Partial<TeamPokemon>[] = Array.from(
      { length: 6 },
      () => emptyPokemon(),
    );
    for (let i = 0; i < Math.min(imported.length, 6); i++) {
      slots[i] = { ...imported[i] };
    }
    setPokemon(slots);
  }, []);

  const handleSave = useCallback(async () => {
    setErrors([]);

    // Client-side validation
    const validationErrors: string[] = [];
    if (!teamName.trim()) {
      validationErrors.push("Team name is required.");
    }

    const filledPokemon = pokemon.filter((p) => p.species && p.species.trim());
    if (filledPokemon.length === 0) {
      validationErrors.push("At least 1 Pokemon is required.");
    }

    for (let i = 0; i < filledPokemon.length; i++) {
      const p = filledPokemon[i];
      if (!p.ability) {
        validationErrors.push(
          `${p.species}: Ability is required.`,
        );
      }
      const moveCount = (p.moves ?? []).filter(Boolean).length;
      if (moveCount === 0) {
        validationErrors.push(
          `${p.species}: At least 1 move is required.`,
        );
      }
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Build the payload: only include filled Pokemon, with non-empty moves
    const payloadPokemon = filledPokemon.map((p) => ({
      species: p.species!,
      ability: p.ability!,
      item: p.item ?? "",
      nature: p.nature ?? "Hardy",
      level: p.level ?? 50,
      teraType: p.teraType,
      moves: (p.moves ?? ["", "", "", ""]).filter(Boolean),
      evs: p.evs ?? { ...DEFAULT_EVS },
      ivs: p.ivs ?? { ...DEFAULT_IVS },
    }));

    // Generate pokepaste for storage
    const fullPokemon = payloadPokemon.map((p) => ({
      ...p,
      moves: [
        ...p.moves,
        ...Array(4 - p.moves.length).fill(""),
      ] as [string, string, string, string],
    }));
    const pokepaste = exportTeamToPaste(fullPokemon as TeamPokemon[]);

    const payload = {
      name: teamName.trim(),
      format,
      pokemon: payloadPokemon,
      pokepaste,
    };

    setSaving(true);
    try {
      const url = isEditing ? `/api/teams/${teamId}` : "/api/teams";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const serverErrors = data.details ?? [data.error ?? "Save failed"];
        setErrors(
          Array.isArray(serverErrors) ? serverErrors : [serverErrors],
        );
        return;
      }

      // Navigate to team detail page on success
      const savedId = data.team?.id ?? teamId;
      router.push(`/teams/${savedId}`);
    } catch (err) {
      setErrors([
        err instanceof Error ? err.message : "Failed to save team",
      ]);
    } finally {
      setSaving(false);
    }
  }, [teamName, format, pokemon, isEditing, teamId, router]);

  if (loadingTeam) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-muted">Loading team...</span>
      </div>
    );
  }

  // Build tab labels
  const tabLabels = pokemon.map(
    (p, i) => p.species || `Slot ${i + 1}`,
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Team Info */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Team Name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="My VGC Team"
            />
            <Select
              label="Format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pokemon Tabs */}
      <Card>
        <CardContent>
          <Tabs defaultTab="slot-0">
            <TabList className="overflow-x-auto">
              {tabLabels.map((label, i) => (
                <Tab key={i} value={`slot-${i}`}>
                  {label}
                </Tab>
              ))}
              <Tab value="import">Import</Tab>
            </TabList>

            {pokemon.map((mon, i) => (
              <TabPanel key={i} value={`slot-${i}`}>
                <PokemonForm
                  value={mon}
                  onChange={(updated) => updateSlot(i, updated)}
                  slot={i + 1}
                />
              </TabPanel>
            ))}

            <TabPanel value="import">
              <TeamImport onImport={handleImport} />
            </TabPanel>
          </Tabs>
        </CardContent>
      </Card>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-destructive/50 bg-red-950/20 px-4 py-3">
          <div className="text-sm font-medium text-destructive mb-1">
            {errors.length === 1 ? "Error" : "Errors"}
          </div>
          <ul className="list-disc list-inside text-xs text-destructive space-y-0.5">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Save Button */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving
            ? "Saving..."
            : isEditing
              ? "Update Team"
              : "Save Team"}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/teams")}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
