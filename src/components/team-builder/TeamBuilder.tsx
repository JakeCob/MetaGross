"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PokemonForm } from "./PokemonForm";
import { PokemonSlotCard } from "./PokemonSlotCard";
import { TeamImport } from "./TeamImport";
import { AITeamSuggestions } from "./AITeamSuggestions";
import { TeamDebatePanel, type TeamDebateMember } from "./TeamDebatePanel";
import { SlotAISuggestions } from "./SlotAISuggestions";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { DEFAULT_EVS, DEFAULT_IVS } from "@/lib/types/pokemon";

const FORMATS = [
  "Champions Reg M-B",
  "Champions Reg M-A",
  "VGC 2026 Reg I",
  "VGC 2026 Reg F",
  "VGC 2025 Reg H",
  "VGC 2025 Reg G",
  "VGC 2024 Reg F",
  "Battle Stadium Doubles",
  "Other",
];

// Team archetype presets for Champions (valid across M-A / M-B)
const TEAM_PRESETS = [
  {
    name: "Rain",
    emoji: "🌧️",
    core: ["Pelipper", "Dragonite", "Kingambit"],
    description: "Drizzle + Swift Swim / rain abusers",
  },
  {
    name: "Sun",
    emoji: "☀️",
    core: ["Charizard", "Whimsicott", "Incineroar"],
    description: "Drought + Chlorophyll / sun attackers",
  },
  {
    name: "Sand",
    emoji: "🏜️",
    core: ["Tyranitar", "Garchomp", "Incineroar"],
    description: "Sand Stream + Sand Rush",
  },
  {
    name: "Snow",
    emoji: "❄️",
    core: ["Ninetales-Alola", "Froslass", "Glaceon"],
    description: "Snow Warning + Slush Rush + Aurora Veil",
  },
  {
    name: "Trick Room",
    emoji: "🔮",
    core: ["Sinistcha", "Farigiraf", "Incineroar"],
    description: "Trick Room setters + slow attackers",
  },
  {
    name: "Hyper Offense",
    emoji: "⚔️",
    core: ["Sneasler", "Dragonite", "Garchomp"],
    description: "Fast, aggressive, KO-focused",
  },
  {
    name: "Goodstuffs",
    emoji: "⭐",
    core: ["Incineroar", "Sneasler", "Archaludon"],
    description: "Top meta picks, balanced",
  },
] as const;

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

export interface CurrentTeamSnapshot {
  name: string;
  format: string;
  pokemon: Partial<TeamPokemon>[];
}

export interface TeamBuilderProps {
  teamId?: string;
  initialSpecies?: string[];
  initialName?: string;
  onAddFromAgent?: (addFn: (pokemon: Partial<TeamPokemon>) => void) => void;
  onReplaceFromAgent?: (
    replaceFn: (pokemon: Partial<TeamPokemon>[]) => void,
  ) => void;
  /** Exposes a live getter so the parent can read the current draft
   *  team state at any time (e.g. to attach it to an /api/agent POST
   *  so the agent can patch it instead of generating a new one). */
  onCurrentTeamRef?: (getFn: () => CurrentTeamSnapshot) => void;
}

export function TeamBuilder({
  teamId,
  initialSpecies,
  initialName,
  onAddFromAgent,
  onReplaceFromAgent,
  onCurrentTeamRef,
}: TeamBuilderProps) {
  const router = useRouter();
  const isEditing = Boolean(teamId);

  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [format, setFormat] = useState(FORMATS[0]);
  const [pokemon, setPokemon] = useState<Partial<TeamPokemon>[]>(() =>
    Array.from({ length: 6 }, () => emptyPokemon()),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Apply initial species / name from query params (only on mount, only when creating)
  useEffect(() => {
    if (teamId) return; // editing existing team — skip
    if (initialName && initialName.trim()) {
      setTeamName((prev) => (prev.trim() ? prev : initialName.trim()));
    }
    if (initialSpecies && initialSpecies.length > 0) {
      setPokemon(() => {
        const slots: Partial<TeamPokemon>[] = Array.from(
          { length: 6 },
          () => emptyPokemon(),
        );
        for (let i = 0; i < Math.min(initialSpecies.length, 6); i++) {
          slots[i] = { ...emptyPokemon(), species: initialSpecies[i] };
        }
        return slots;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a ref to the latest draft so the getCurrentTeam snapshot the
  // parent calls always sees fresh state, not a stale closure value.
  const latestRef = useRef({ pokemon, teamName, format });
  useEffect(() => {
    latestRef.current = { pokemon, teamName, format };
  }, [pokemon, teamName, format]);

  // Publish a getter the parent can invoke at any time to read the
  // current draft team. This is how the AgentPanel attaches a
  // `draftTeam` to its /api/agent POST so the agent can see the team
  // the user is actively editing.
  useEffect(() => {
    if (!onCurrentTeamRef) return;
    onCurrentTeamRef(() => ({
      name: latestRef.current.teamName,
      format: latestRef.current.format,
      pokemon: latestRef.current.pokemon,
    }));
  }, [onCurrentTeamRef]);

  // Register the add-from-agent callback
  useEffect(() => {
    if (onAddFromAgent) {
      onAddFromAgent((newPokemon: Partial<TeamPokemon>) => {
        setPokemon((prev) => {
          const next = [...prev];
          const emptyIdx = next.findIndex((p) => !p.species?.trim());
          if (emptyIdx === -1) {
            // No empty slot — overwrite the last slot so the add never
            // silently fails. "+ Add All N to Team" uses
            // onReplaceFromAgent for a cleaner bulk path.
            next[next.length - 1] = { ...emptyPokemon(), ...newPokemon };
            return next;
          }
          next[emptyIdx] = { ...emptyPokemon(), ...newPokemon };
          return next;
        });
      });
    }
  }, [onAddFromAgent]);

  // Register the replace-from-agent callback — used by "+ Add All 6".
  // This wholesale-replaces the 6 slots with the agent's team so the
  // user never has to clear the builder by hand before applying a new
  // suggestion.
  useEffect(() => {
    if (onReplaceFromAgent) {
      onReplaceFromAgent((newTeam: Partial<TeamPokemon>[]) => {
        setPokemon(() => {
          const slots: Partial<TeamPokemon>[] = Array.from(
            { length: 6 },
            () => emptyPokemon(),
          );
          for (let i = 0; i < Math.min(newTeam.length, 6); i++) {
            slots[i] = { ...emptyPokemon(), ...newTeam[i] };
          }
          return slots;
        });
      });
    }
  }, [onReplaceFromAgent]);

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
        setDescription(team.description ?? "");
        setNotes(team.notes ?? "");
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

  /** Replace the team with a debated build (full sets, incl. optimized EVs/nature). */
  const handleDebateApply = useCallback((members: TeamDebateMember[]) => {
    const imported: Partial<TeamPokemon>[] = members.slice(0, 6).map((m) => {
      const base = emptyPokemon();
      return {
        ...base,
        species: m.species,
        item: m.item ?? "",
        ability: m.ability ?? "",
        moves: [
          m.moves?.[0] ?? "",
          m.moves?.[1] ?? "",
          m.moves?.[2] ?? "",
          m.moves?.[3] ?? "",
        ] as [string, string, string, string],
        ...(m.nature ? { nature: m.nature } : {}),
        ...(m.evs ? { evs: m.evs } : {}),
      };
    });
    handleImport(imported as TeamPokemon[]);
  }, [handleImport]);

  const handleSuggestionAdd = useCallback((species: string) => {
    setPokemon((prev) => {
      const next = [...prev];
      // Find the first empty slot
      const emptyIdx = next.findIndex((p) => !p.species?.trim());
      if (emptyIdx === -1) return next; // no empty slots
      next[emptyIdx] = { ...emptyPokemon(), species };
      return next;
    });
  }, []);

  // Derive current filled species for suggestions
  const filledSpecies = pokemon
    .filter((p) => p.species?.trim())
    .map((p) => p.species!.trim());
  // Richer details so the AI suggester can reason about items/abilities/megas.
  const filledDetails = pokemon
    .filter((p) => p.species?.trim())
    .map((p) => ({
      species: p.species!.trim(),
      item: p.item?.trim() || undefined,
      ability: p.ability?.trim() || undefined,
    }));
  const hasEmptySlots = pokemon.some((p) => !p.species?.trim());

  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  /**
   * Serialise the current team to Showdown pokepaste format and copy it
   * to the clipboard. We format it inline because @pkmn/sets is server-
   * only and this doesn't need a round-trip for such a small string.
   */
  const handleExportPokepaste = useCallback(async () => {
    const filled = pokemon.filter((p) => p.species && p.species.trim());
    if (filled.length === 0) {
      setExportFeedback("Team is empty — nothing to export.");
      setTimeout(() => setExportFeedback(null), 2500);
      return;
    }

    const statOrder: Array<[keyof NonNullable<TeamPokemon["evs"]>, string]> = [
      ["hp", "HP"],
      ["atk", "Atk"],
      ["def", "Def"],
      ["spa", "SpA"],
      ["spd", "SpD"],
      ["spe", "Spe"],
    ];

    const blocks = filled.map((p) => {
      const lines: string[] = [];
      const header = p.item
        ? `${p.species} @ ${p.item}`
        : (p.species ?? "");
      lines.push(header);
      if (p.ability) lines.push(`Ability: ${p.ability}`);
      lines.push(`Level: ${p.level ?? 50}`);
      if (p.teraType) lines.push(`Tera Type: ${p.teraType}`);

      const evParts: string[] = [];
      for (const [key, label] of statOrder) {
        const v = p.evs?.[key];
        if (v && v > 0) evParts.push(`${v} ${label}`);
      }
      if (evParts.length > 0) lines.push(`EVs: ${evParts.join(" / ")}`);

      if (p.nature) lines.push(`${p.nature} Nature`);

      const ivParts: string[] = [];
      for (const [key, label] of statOrder) {
        const v = p.ivs?.[key];
        if (v !== undefined && v !== 31) ivParts.push(`${v} ${label}`);
      }
      if (ivParts.length > 0) lines.push(`IVs: ${ivParts.join(" / ")}`);

      for (const m of p.moves ?? []) {
        if (m && m.trim()) lines.push(`- ${m.trim()}`);
      }
      return lines.join("\n");
    });

    // Drop the `=== [format] Name ===` header — Showdown's paste
    // importer rejects any team whose format tag isn't a known
    // Showdown format id (e.g. gen9vgc2025regg). "Champions Reg M-A"
    // isn't recognised, so the whole paste fails silently. Emitting
    // just the per-Pokemon blocks imports cleanly on Showdown and
    // pokepaste.es alike.
    const paste = blocks.join("\n\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(paste);
        setExportFeedback("Pokepaste copied to clipboard");
      } else {
        // Fallback for non-secure contexts.
        const ta = document.createElement("textarea");
        ta.value = paste;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setExportFeedback("Pokepaste copied (legacy fallback)");
      }
    } catch (err) {
      console.error("[TeamBuilder] copy failed", err);
      setExportFeedback("Copy failed — see console");
    }
    setTimeout(() => setExportFeedback(null), 3000);
  }, [pokemon, teamName, format]);

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
      description: description.trim() || null,
      notes: notes.trim() || null,
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

      // After save, land on the EDIT view (not the read-only detail
      // page). This keeps the Agent panel live with a real contextId
      // so get_team and propose_pokemon_patch work against the team
      // the user just saved. The old redirect to /teams/[id] dropped
      // the agent panel entirely.
      const savedId = data.team?.id ?? teamId;
      if (isEditing) {
        // Already on the edit page — just refresh state.
        router.refresh();
      } else {
        router.push(`/teams/${savedId}/edit`);
      }
    } catch (err) {
      setErrors([
        err instanceof Error ? err.message : "Failed to save team",
      ]);
    } finally {
      setSaving(false);
    }
  }, [teamName, format, pokemon, description, notes, isEditing, teamId, router]);

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
        <CardContent className="flex flex-col gap-4">
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

          {/* Description — short strategy summary. Read by the agents. */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="team-description">
              Strategy / Description
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                (the AI reads this — explain your win condition + gameplan)
              </span>
            </Label>
            <textarea
              id="team-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Rain hyper offense built around Archaludon Stamina stacking. Pelipper leads with Focus Sash for guaranteed Rain + Tailwind turn 1. Basculegion is the late-game cleaner under Rain. Kingambit handles Ghost / Psychic threats."
              rows={3}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y min-h-[72px]"
            />
          </div>

          {/* Notes — free-form memo. Also read by agents but less primary. */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="team-notes">
              Notes
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                (results, matchup thoughts, anything else)
              </span>
            </Label>
            <textarea
              id="team-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 7-2 at Portland regional. Struggles into Tatsugiri+Dondozo — need a better answer than Kingambit."
              rows={2}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y min-h-[56px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Team Archetype Presets — shown for any Champions regulation (M-A/M-B). */}
      {!isEditing && format.startsWith("Champions Reg") && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Quick Start — pick an archetype to pre-fill core Pokemon
          </p>
          <div className="flex flex-wrap gap-2">
            {TEAM_PRESETS.map((preset) => (
              <Button
                key={preset.name}
                variant="outline"
                size="sm"
                title={preset.description}
                onClick={() => {
                  const slots: Partial<TeamPokemon>[] = Array.from(
                    { length: 6 },
                    () => emptyPokemon(),
                  );
                  preset.core.forEach((species, i) => {
                    slots[i] = { ...emptyPokemon(), species };
                  });
                  setPokemon(slots);
                  if (!teamName.trim()) {
                    setTeamName(`${preset.name} Team`);
                  }
                }}
              >
                <span className="mr-1">{preset.emoji}</span>
                {preset.name}
              </Button>
            ))}
          </div>
        </div>
      )}

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
            format={format}
          />
        ))}
      </div>

      {/* AI Team Suggestions */}
      {filledSpecies.length >= 1 && hasEmptySlots && (
        <AITeamSuggestions
          pokemon={filledSpecies}
          teamDetails={filledDetails}
          format={format}
          onAdd={handleSuggestionAdd}
          hasEmptySlots={hasEmptySlots}
        />
      )}

      {/* Multi-agent team debate — build/finish a whole team around the
          current core (or from scratch) with offense/defense/data/critic
          agents. */}
      <TeamDebatePanel
        seed={filledDetails}
        format={format}
        onApplyTeam={handleDebateApply}
      />

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => setImportDialogOpen(true)}
        >
          Import Paste
        </Button>
        <Button
          variant="outline"
          onClick={handleExportPokepaste}
          title="Copy the team as a Showdown-compatible pokepaste"
        >
          Export Pokepaste
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving
            ? "Saving..."
            : isEditing
              ? "Update Team"
              : "Save Team"}
        </Button>
        {exportFeedback && (
          <span className="self-center text-xs text-muted-foreground">
            {exportFeedback}
          </span>
        )}
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

      {/* Editing Form (floating modal) */}
      <Dialog
        open={editingSlot !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setEditingSlot(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-visible">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>
                {editingPokemon?.species
                  ? `Editing: ${editingPokemon.species}`
                  : `Slot ${(editingSlot ?? 0) + 1} — Add Pokemon`}
              </span>
              <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">
                {format}
              </span>
            </DialogTitle>
          </DialogHeader>
          {editingSlot !== null && editingPokemon && (
            <div className="overflow-visible">
              {/* AI suggestions for this slot */}
              {filledSpecies.length >= 1 && (
                <SlotAISuggestions
                  currentTeam={filledSpecies.filter(
                    (s) => s !== editingPokemon.species,
                  )}
                  slot={editingSlot + 1}
                  format={format}
                  onSelect={(species) => {
                    updateSlot(editingSlot, {
                      ...editingPokemon,
                      species,
                    });
                  }}
                />
              )}
              <PokemonForm
                value={editingPokemon}
                onChange={(updated) => updateSlot(editingSlot, updated)}
                slot={editingSlot + 1}
                format={format}
                team={pokemon as Partial<TeamPokemon>[]}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

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
