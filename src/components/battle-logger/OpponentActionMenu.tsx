"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DamageInput } from "./DamageInput";
import { DamagePreviewTag } from "./DamagePreviewTag";
import { getMegaFormFor } from "@/lib/data/champions";
import {
  resolveToTeamPokemon,
  getDamagePreview,
  type DamagePreview,
} from "@/lib/engine/damage-preview";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { ActivePokemon, FieldState, Slot, TurnAction } from "@/lib/types/battle";
import type { PredictedSet } from "@/lib/ai/opponent-scouting/types";

type MenuPhase = "moves" | "target" | "damage" | "status-confirm";

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
  useEffect(() => {
    setAbilityDraft(knownAbility ?? "");
    setItemDraft(knownItem ?? "");
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
    // Status moves usually don't deal damage → skip target/damage prompts.
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

  const emitAndClose = (
    damage: number | null,
    wasCrit: boolean,
    wasKo: boolean,
  ) => {
    if (!selectedMove) return;
    // Persist any dirty reveal-info first so a single confirmation
    // commits both the move and the ability/item reveal.
    saveInfo();
    const action: TurnAction = {
      side: "p2",
      slot,
      actionType: "move",
      moveName: selectedMove,
      targetSide: targetSlot ? "p1" : undefined,
      targetSlot: targetSlot ?? undefined,
      damageDealtPercent: damage ?? undefined,
      wasCriticalHit: wasCrit,
      wasKo,
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

          <div className="max-h-56 overflow-y-auto rounded-md border border-border/60 bg-card">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {loading
                  ? "Loading…"
                  : "No matches. Press Enter to use the typed move anyway."}
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              saveInfo();
              onClose();
            }}
          >
            Save info only (skip move)
          </Button>
        </div>
      )}

      {/* Phase: Target selection (with damage previews) */}
      {phase === "target" && (() => {
        // Pre-compute damage previews: opponent attacker → each of my actives.
        const ctx = { myTeam, opponentTeam, predictions, format };
        const attackerResolved = resolveToTeamPokemon(pokemon, "p2", ctx);
        // Override ability/item with the draft reveals if the user just typed them.
        if (abilityDraft.trim()) attackerResolved.ability = abilityDraft.trim();
        if (itemDraft.trim()) attackerResolved.item = itemDraft.trim();
        const myPreviews = new Map<string, DamagePreview | null>();
        if (selectedMove) {
          for (const m of myActive) {
            if (m.hpPercent <= 0) continue;
            const defender = resolveToTeamPokemon(m, "p1", ctx);
            myPreviews.set(m.species, getDamagePreview(attackerResolved, defender, selectedMove, fieldState));
          }
        }
        return (
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
        );
      })()}

      {/* Phase: Damage */}
      {phase === "damage" && targetSlot != null && (
        <DamageInput
          targetName={myActive[targetSlot - 1]?.species ?? "My Pokemon"}
          onConfirm={(dmg, wasCrit, wasKo) => emitAndClose(dmg, wasCrit, wasKo)}
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
              onClick={() => emitAndClose(null, false, false)}
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
