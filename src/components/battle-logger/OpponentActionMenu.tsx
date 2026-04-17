"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DamageInput, type DamageInputResult } from "./DamageInput";
import { DamagePreviewTag } from "./DamagePreviewTag";
import { getMegaFormFor } from "@/lib/data/champions";
import { getMove } from "@/lib/pokemon/moves";

/** Move targets that take no enemy target + no damage prompt. */
const NO_TARGET_TARGETS = new Set([
  "self",
  "allies",
  "adjacentAlly",
  "adjacentAllyOrSelf",
  "allySide",
  "allyTeam",
  "foeSide",
  "all",
]);
import {
  resolveToTeamPokemon,
  getDamagePreview,
  type DamagePreview,
} from "@/lib/engine/damage-preview";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { ActivePokemon, FieldState, Side, Slot, StatChange, TurnAction } from "@/lib/types/battle";
import type { PredictedSet } from "@/lib/ai/opponent-scouting/types";

type MenuPhase = "moves" | "target" | "damage" | "status-confirm" | "switch";

export interface OpponentActionMenuProps {
  /** The opponent's active Pokemon whose action we're logging. */
  pokemon: ActivePokemon;
  /** Slot index (1 or 2) the opponent's Pokemon is in. */
  slot: Slot;
  /** Known ability/item (from team preview or prior reveals). */
  knownAbility: string;
  knownItem: string;
  /** My active Pokemon — possible targets. */
  myActive: ActivePokemon[];
  /** Context for damage preview resolution. */
  myTeam?: TeamPokemon[];
  opponentTeam?: Partial<TeamPokemon>[];
  predictions?: PredictedSet[];
  fieldState?: Partial<FieldState>;
  format?: string;
  /** Persist a reveal (ability / item) to the opponent team snapshot. */
  onUpdateInfo: (info: { ability?: string; item?: string }) => void;
  /** Mark the opponent's Pokemon as having Mega Evolved. */
  onToggleMega: (isMega: boolean) => void;
  /** Reveal this slot's true species (Zoroark Illusion, Ditto Imposter). */
  onRevealDisguise: (realSpecies: string) => void;
  onAction: (action: TurnAction) => void;
  onClose: () => void;
}

interface MoveRow {
  name: string;
  category: "Physical" | "Special" | "Status" | string;
  type: string;
}

export function OpponentActionMenu({
  pokemon,
  slot,
  knownAbility,
  knownItem,
  myActive,
  myTeam = [],
  opponentTeam = [],
  predictions,
  fieldState,
  format,
  onUpdateInfo,
  onToggleMega,
  onRevealDisguise,
  onAction,
  onClose,
}: OpponentActionMenuProps) {
  const [phase, setPhase] = useState<MenuPhase>("moves");
  const [query, setQuery] = useState("");
  const [selectedMove, setSelectedMove] = useState<string | null>(null);
  const [, setSelectedCategory] = useState<string>("");
  const [targetSlot, setTargetSlot] = useState<Slot | null>(null);
  const [legalMoves, setLegalMoves] = useState<MoveRow[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reveal-info local state — kept in sync with the props when the
  // Pokemon/slot changes so you can edit and save.
  const [abilityDraft, setAbilityDraft] = useState(knownAbility ?? "");
  const [itemDraft, setItemDraft] = useState(knownItem ?? "");
  const [disguiseDraft, setDisguiseDraft] = useState("");
  const [showDisguise, setShowDisguise] = useState(false);
  useEffect(() => {
    setAbilityDraft(knownAbility ?? "");
    setItemDraft(knownItem ?? "");
    setDisguiseDraft("");
    setShowDisguise(false);
  }, [knownAbility, knownItem, pokemon.species]);

  const abilityDirty = (abilityDraft ?? "").trim() !== (knownAbility ?? "").trim();
  const itemDirty = (itemDraft ?? "").trim() !== (knownItem ?? "").trim();
  const infoDirty = abilityDirty || itemDirty;

  const canMegaEvolve = Boolean(getMegaFormFor(pokemon.species, itemDraft));
  const isMegaNow = Boolean(pokemon.isMega);

  const saveInfo = () => {
    const payload: { ability?: string; item?: string } = {};
    if (abilityDirty) payload.ability = abilityDraft.trim();
    if (itemDirty) payload.item = itemDraft.trim();
    if (Object.keys(payload).length > 0) onUpdateInfo(payload);
  };

  /**
   * Damage previews for the opponent's move against each of my actives —
   * used both in the target-selection screen (to render per-target
   * preview tags) and in the damage screen (as the `suggestedDamage`
   * chip on DamageInput).
   */
  const myPreviews = useMemo<Map<string, DamagePreview | null>>(() => {
    const map = new Map<string, DamagePreview | null>();
    if (!selectedMove) return map;
    const ctx = { myTeam, opponentTeam, predictions, format };
    const attackerResolved = resolveToTeamPokemon(pokemon, "p2", ctx);
    if (abilityDraft.trim()) attackerResolved.ability = abilityDraft.trim();
    if (itemDraft.trim()) attackerResolved.item = itemDraft.trim();
    for (const m of myActive) {
      if (m.hpPercent <= 0) continue;
      const defender = resolveToTeamPokemon(m, "p1", ctx);
      map.set(
        m.species,
        getDamagePreview(
          attackerResolved,
          defender,
          selectedMove,
          fieldState,
          pokemon.boosts,
          m.boosts,
        ),
      );
    }
    return map;
  }, [
    selectedMove,
    pokemon,
    myActive,
    myTeam,
    opponentTeam,
    predictions,
    format,
    fieldState,
    abilityDraft,
    itemDraft,
  ]);

  useEffect(() => {
    if (!pokemon.species) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/pokemon/${encodeURIComponent(pokemon.species)}/moves?detail=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { names?: string[]; data?: Record<string, MoveRow> } | null) => {
        if (cancelled || !data?.names) return;
        const rows = data.names.map((n) => ({
          name: n,
          category: data.data?.[n]?.category ?? "",
          type: data.data?.[n]?.type ?? "",
        }));
        setLegalMoves(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pokemon.species]);

  // Auto-focus the search box when the menu mounts.
  useEffect(() => {
    if (phase === "moves") inputRef.current?.focus();
  }, [phase]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return legalMoves.slice(0, 12);
    return legalMoves
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [legalMoves, query]);

  const pickMove = (move: { name: string; category: string }) => {
    setSelectedMove(move.name);
    setSelectedCategory(move.category || "");

    // No-target moves (Protect / Swords Dance / Tailwind / Trick Room /
    // Stealth Rock / Rain Dance / ...): log immediately, no target and
    // no damage prompt.
    const moveData = getMove(move.name);
    if (moveData && NO_TARGET_TARGETS.has(moveData.target)) {
      saveInfo();
      const action: TurnAction = {
        side: "p2",
        slot,
        actionType: "move",
        moveName: move.name,
      };
      onAction(action);
      onClose();
      return;
    }

    // Status moves that target an enemy (Thunder Wave / Taunt /
    // Will-O-Wisp / Spore): skip the damage dialog, let the user
    // confirm — they can still log status inflicted or flinch.
    if ((move.category || "").toLowerCase() === "status") {
      setPhase("status-confirm");
    } else {
      setPhase("target");
    }
  };

  const handleTypedMoveSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    // Try to match against legal moves first; otherwise accept free text.
    const match = legalMoves.find(
      (m) => m.name.toLowerCase() === trimmed.toLowerCase(),
    );
    pickMove({ name: match?.name ?? trimmed, category: match?.category ?? "" });
  };

  const handleTarget = (mySlot: Slot) => {
    setTargetSlot(mySlot);
    setPhase("damage");
  };

  const handleSpread = () => {
    // Convention: record spread hit on slot 1; the apply step in the logger
    // already only damages the specified slot, but keeping the convention.
    setTargetSlot(1);
    setPhase("damage");
  };

  const emitAndClose = (r: DamageInputResult | null) => {
    if (!selectedMove) return;
    // Persist any dirty reveal-info first so a single confirmation
    // commits both the move and the ability/item reveal.
    saveInfo();
    const statChanges: StatChange[] = [];
    if (r?.targetStatChanges?.length && targetSlot) {
      for (const sc of r.targetStatChanges) {
        statChanges.push({ side: "p1" as Side, slot: targetSlot, stat: sc.stat, delta: sc.delta });
      }
    }
    if (r?.selfStatChanges?.length) {
      for (const sc of r.selfStatChanges) {
        statChanges.push({ side: "p2" as Side, slot, stat: sc.stat, delta: sc.delta });
      }
    }
    const action: TurnAction = {
      side: "p2",
      slot,
      actionType: "move",
      moveName: selectedMove,
      targetSide: targetSlot ? "p1" : undefined,
      targetSlot: targetSlot ?? undefined,
      damageDealtPercent: r?.damage ?? undefined,
      wasCriticalHit: r?.wasCrit ?? false,
      wasKo: r?.wasKo ?? false,
      wasMiss: r?.wasMiss ?? false,
      causedFlinch: r?.causedFlinch ?? false,
      inflictedStatus: r?.inflictedStatus ?? null,
      removedItem: r?.removedItem ?? false,
      statChanges: statChanges.length > 0 ? statChanges : undefined,
    };
    onAction(action);
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">
          Opponent: {pokemon.species}
          {phase !== "moves" && selectedMove && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              — {selectedMove}
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Reveal-info panel — always visible on the Move phase */}
      {phase === "moves" && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Reveal opponent info
            </span>
            {isMegaNow && (
              <Badge
                variant="warning"
                className="text-[9px] px-1.5 uppercase tracking-wider"
              >
                Mega
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="opp-ability" className="text-[11px]">
                Ability
              </Label>
              <Input
                id="opp-ability"
                value={abilityDraft}
                onChange={(e) => setAbilityDraft(e.target.value)}
                placeholder="e.g. Intimidate"
                className="h-8 text-xs"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="opp-item" className="text-[11px]">
                Item
              </Label>
              <Input
                id="opp-item"
                value={itemDraft}
                onChange={(e) => setItemDraft(e.target.value)}
                placeholder="e.g. Focus Sash"
                className="h-8 text-xs"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {canMegaEvolve && (
              <Button
                type="button"
                variant={isMegaNow ? "default" : "outline"}
                size="sm"
                className="text-xs h-7"
                onClick={() => onToggleMega(!isMegaNow)}
                title={
                  isMegaNow
                    ? "Unmark as Mega (if logged in error)"
                    : "Mark this Pokemon as having Mega Evolved"
                }
              >
                {isMegaNow ? "✓ Mega Evolved" : "Mega Evolve"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 ml-auto"
              onClick={saveInfo}
              disabled={!infoDirty}
            >
              Save info
            </Button>
          </div>

          {/* Illusion / Imposter — reveal the true species */}
          {!showDisguise ? (
            <button
              type="button"
              onClick={() => setShowDisguise(true)}
              className="text-[10px] text-muted-foreground underline hover:text-foreground text-left cursor-pointer"
            >
              Actually a disguise? (Zoroark / Ditto) →
            </button>
          ) : (
            <div className="flex flex-col gap-1 rounded border border-border/40 bg-muted/30 p-2">
              <Label htmlFor="disguise-real" className="text-[11px]">
                True species (Illusion / Imposter)
              </Label>
              <div className="flex gap-1">
                <Input
                  id="disguise-real"
                  value={disguiseDraft}
                  onChange={(e) => setDisguiseDraft(e.target.value)}
                  placeholder={
                    pokemon.disguisedAs
                      ? `Currently shown as ${pokemon.species}`
                      : "e.g. Zoroark"
                  }
                  className="h-7 text-xs"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={
                    !disguiseDraft.trim() ||
                    disguiseDraft.trim() === pokemon.species
                  }
                  onClick={() => {
                    onRevealDisguise(disguiseDraft.trim());
                    setDisguiseDraft("");
                    setShowDisguise(false);
                  }}
                >
                  Reveal
                </Button>
              </div>
              {pokemon.disguisedAs && (
                <span className="text-[10px] text-muted-foreground">
                  Already revealed — was{" "}
                  <span className="line-through">{pokemon.disguisedAs}</span>.
                  Enter a new value only to correct a mistake.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Phase: Move entry */}
      {phase === "moves" && (
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opp-move">
              Move used (search {pokemon.species}&apos;s learnset or type free-text)
            </Label>
            <Input
              ref={inputRef}
              id="opp-move"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  // If the top filtered row is a clean prefix match, pick it.
                  if (filtered.length > 0) pickMove(filtered[0]);
                  else handleTypedMoveSubmit();
                }
              }}
              placeholder={
                loading ? "Loading learnset…" : "e.g. Earthquake, Protect, Fake Out…"
              }
              disabled={loading}
              autoComplete="off"
            />
          </div>

          {/* Always-visible "use typed query" action when the user has
              typed something — works whether or not the learnset has a
              match. Solves "I couldn't enter a move when searching". */}
          {query.trim().length > 0 && (
            <button
              type="button"
              onClick={() =>
                pickMove({ name: query.trim(), category: "" })
              }
              className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm text-primary hover:bg-primary/20 cursor-pointer"
              title="Log this exact text as the move name — no learnset check"
            >
              <span className="font-medium">Use &quot;{query.trim()}&quot; as move</span>
              <span className="text-[10px] opacity-80">↵ Enter</span>
            </button>
          )}

          <div className="max-h-56 overflow-y-auto rounded-md border border-border/60 bg-card">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-center">
                <p className="text-sm text-muted-foreground">
                  {loading
                    ? "Loading…"
                    : `No learnset match for "${query.trim() || "…"}".`}
                </p>
                {!loading && query.trim().length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Click the blue button above (or press Enter) to log the
                    typed move anyway. Useful for tutor-only moves, renamed
                    moves, or when learnset data is out of date.
                  </p>
                )}
              </div>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => pickMove(m)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm cursor-pointer hover:bg-accent/40"
                >
                  <span className="font-medium text-foreground">{m.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {m.type} · {m.category}
                  </span>
                </button>
              ))
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Unknown move? Just type it and hit Enter — moves aren&apos;t validated.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => {
                saveInfo();
                setPhase("switch");
              }}
            >
              Switched out
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => {
                saveInfo();
                onClose();
              }}
            >
              Save info only
            </Button>
          </div>
        </div>
      )}

      {/* Phase: Switch (opponent pulled a Pokemon back or forced-switched) */}
      {phase === "switch" && (
        <OpponentSwitchPicker
          currentSpecies={pokemon.species}
          opponentTeam={opponentTeam ?? []}
          onBack={() => setPhase("moves")}
          onPick={(newSpecies) => {
            saveInfo();
            const action: TurnAction = {
              side: "p2",
              slot,
              actionType: "switch",
              switchOutSpecies: pokemon.species,
              switchInSpecies: newSpecies,
            };
            onAction(action);
            onClose();
          }}
        />
      )}

      {/* Phase: Target selection (with damage previews) */}
      {phase === "target" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Which of your Pokemon did it hit?
          </p>
          <div className="grid grid-cols-1 gap-2">
            {myActive.map((m, i) => {
              const preview = myPreviews.get(m.species) ?? null;
              return (
              <Button
                key={`my-${i}-${m.species}`}
                variant="outline"
                size="lg"
                className="w-full justify-between border-destructive/30 hover:bg-destructive/10"
                disabled={m.hpPercent <= 0}
                onClick={() => handleTarget((i + 1) as Slot)}
              >
                <span>
                  {m.species}
                  {m.hpPercent <= 0 ? " (KO)" : ""}
                </span>
                {preview && m.hpPercent > 0 && (
                  <DamagePreviewTag preview={preview} />
                )}
              </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={handleSpread}
          >
            Spread (hit both)
          </Button>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setPhase("moves")}>
              Back
            </Button>
            <a
              href="https://calc.pokemonshowdown.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-primary hover:underline"
            >
              Open Showdown Calc
            </a>
          </div>
        </div>
      )}

      {/* Phase: Damage */}
      {phase === "damage" && targetSlot != null && (
        <DamageInput
          targetName={myActive[targetSlot - 1]?.species ?? "My Pokemon"}
          moveName={selectedMove ?? undefined}
          suggestedDamage={
            selectedMove
              ? myPreviews.get(myActive[targetSlot - 1]?.species ?? "") ?? null
              : null
          }
          onConfirm={(r) => emitAndClose(r)}
          onCancel={() => setPhase("target")}
        />
      )}

      {/* Phase: Status-move confirmation (no damage / target optional) */}
      {phase === "status-confirm" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedMove}</span>{" "}
            looks like a status move. Log it without damage?
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setPhase("moves")}
            >
              Back
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => emitAndClose(null)}
            >
              Log move (no damage)
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Wrong call? Go back and I&apos;ll prompt for a target + damage.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setPhase("target")}
          >
            Actually, this move hit something — pick a target
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Opponent switch picker — pick a replacement from the revealed 6 or type
// a new species name (opponent may reveal one we haven't scouted yet).
// ---------------------------------------------------------------------------
function OpponentSwitchPicker({
  currentSpecies,
  opponentTeam,
  onPick,
  onBack,
}: {
  currentSpecies: string;
  opponentTeam: Partial<TeamPokemon>[];
  onPick: (newSpecies: string) => void;
  onBack: () => void;
}) {
  const [custom, setCustom] = useState("");
  const candidates = (opponentTeam ?? [])
    .map((p) => p.species ?? "")
    .filter((s) => s && s !== currentSpecies);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Who did the opponent switch in for{" "}
        <span className="font-medium text-foreground">{currentSpecies}</span>?
      </p>

      {candidates.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {candidates.map((sp) => (
            <Button
              key={sp}
              variant="outline"
              size="sm"
              className="w-full justify-center"
              onClick={() => onPick(sp)}
            >
              {sp}
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="opp-switch-custom" className="text-[11px]">
          Not in the known 6? Type the species:
        </Label>
        <div className="flex gap-2">
          <Input
            id="opp-switch-custom"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="e.g. Grimmsnarl"
            className="text-sm"
            autoComplete="off"
          />
          <Button
            size="sm"
            disabled={!custom.trim() || custom.trim() === currentSpecies}
            onClick={() => onPick(custom.trim())}
          >
            Switch in
          </Button>
        </div>
      </div>

      <Button variant="ghost" size="sm" onClick={onBack}>
        Back
      </Button>
    </div>
  );
}
