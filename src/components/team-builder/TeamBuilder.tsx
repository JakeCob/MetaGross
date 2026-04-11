"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PokemonForm } from "./PokemonForm";
import { PokemonSlotCard } from "./PokemonSlotCard";
import { TeamImport } from "./TeamImport";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { DEFAULT_EVS, DEFAULT_IVS } from "@/lib/types/pokemon";

const FORMATS = [
  "Champions Reg M-A",
  "VGC 2026 Reg I",
  "VGC 2026 Reg F",
  "VGC 2025 Reg H",
  "VGC 2025 Reg G",
  "VGC 2024 Reg F",
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
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

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

  const removeSlot = useCallback((index: number) => {
    setPokemon((prev) => {
      const next = [...prev];
      next[index] = emptyPokemon();
      return next;
    });
    setEditingSlot((prev) => (prev === index ? null : prev));
  }, []);

  const handleImport = useCallback((imported: TeamPokemon[]) => {
    const slots: Partial<TeamPokemon>[] = Array.from(
      { length: 6 },
      () => emptyPokemon(),
    );
    for (let i = 0; i < Math.min(imported.length, 6); i++) {
      slots[i] = { ...imported[i] };
    }
    setPokemon(slots);
    setImportDialogOpen(false);
    setEditingSlot(null);
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

    // Generate pokepaste for storage via API
    const fullPokemon = payloadPokemon.map((p) => ({
      ...p,
      moves: [
        ...p.moves,
        ...Array(4 - p.moves.length).fill(""),
      ] as [string, string, string, string],
    }));
    let pokepaste = "";
    try {
      const pasteRes = await fetch("/api/pokemon/export-paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: fullPokemon }),
      });
      if (pasteRes.ok) {
        const pasteData = await pasteRes.json();
        pokepaste = pasteData.paste ?? "";
      }
    } catch {
      // Non-critical: pokepaste generation failed, continue with empty
    }

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
        <span className="text-sm text-muted-foreground">Loading team...</span>
      </div>
    );
  }

  const editingPokemon = editingSlot !== null ? pokemon[editingSlot] : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isEditing ? "Edit Team" : "Build New Team"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEditing
            ? "Update your VGC team"
            : "Create a new VGC team from scratch or import a paste"}
        </p>
      </div>

      {/* Team Info */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Team Name</Label>
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="My VGC Team"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Format</Label>
              <Select value={format} onValueChange={(val: string | null) => { if (val) setFormat(val); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pokemon Slot Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {pokemon.map((mon, i) => (
          <PokemonSlotCard
            key={i}
            pokemon={mon}
            index={i}
            isSelected={editingSlot === i}
            onSelect={() =>
              setEditingSlot((prev) => (prev === i ? null : i))
            }
            onRemove={() => removeSlot(i)}
          />
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => setImportDialogOpen(true)}
        >
          Import Paste
        </Button>
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

      {/* Editing Form (below grid) */}
      {editingSlot !== null && editingPokemon && (
        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle>
              Editing: Slot {editingSlot + 1}
              {editingPokemon.species
                ? ` \u2014 ${editingPokemon.species}`
                : ""}
            </CardTitle>
            <CardDescription>
              {editingPokemon.species
                ? "Modify this Pokemon's details below"
                : "Search for a Pokemon to add to this slot"}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-visible">
            <PokemonForm
              value={editingPokemon}
              onChange={(updated) => updateSlot(editingSlot, updated)}
              slot={editingSlot + 1}
              format={format}
            />
          </CardContent>
        </Card>
      )}

      {/* Import Paste Dialog */}
      <Dialog
        open={importDialogOpen}
        onOpenChange={(open: boolean) => setImportDialogOpen(open)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Team</DialogTitle>
          </DialogHeader>
          <TeamImport onImport={handleImport} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
