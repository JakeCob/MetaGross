"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DamageInput, type DamageInputResult } from "./DamageInput";
import { DamagePreviewTag } from "./DamagePreviewTag";
import { SwitchSelector } from "./SwitchSelector";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { TurnAction, ActivePokemon, FieldState, Slot, Side, StatChange } from "@/lib/types/battle";
import {
  resolveToTeamPokemon,
  getDamagePreview,
  type DamagePreview,
} from "@/lib/engine/damage-preview";
import { getMegaFormFor } from "@/lib/data/champions";
import { getMove } from "@/lib/pokemon/moves";
import type { PredictedSet } from "@/lib/ai/opponent-scouting/types";

/**
 * Damaging-spread targets — blast every live foe in doubles.
 */
const SPREAD_TARGETS = new Set([
  "allAdjacentFoes",
  "allAdjacent",
]);

/**
 * "No-target" move categories. These moves target the user, allies, or
 * the field, not an opposing Pokemon — so they have no damage prompt
 * and no target picker.
 *
 * - self: Protect, Detect, Swords Dance, Recover, Substitute, Nasty Plot…
 * - allies / adjacentAlly / adjacentAllyOrSelf: Helping Hand, Life Dew…
 * - allySide: Reflect, Light Screen, Aurora Veil, Tailwind, Safeguard
 * - allyTeam: (whole-team heals — rare in VGC)
 * - foeSide: Stealth Rock, Spikes, Sticky Web, Toxic Spikes
 * - all: Trick Room, Rain Dance, Sunny Day, Snowscape, Hail, Misty
 *        Terrain, Psychic Terrain, Grassy Terrain, Electric Terrain,
 *        Haze, Defog, Gravity
 */
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

type MenuPhase =
  | "moves"
  | "target"
  | "damage"
  | "spread-damage"
  | "switch";

export interface ActionMenuProps {
  pokemon: TeamPokemon;
  slot: Slot;
  /** Active Pokemon on the opponent's side */
  opponentActive: ActivePokemon[];
  /** Brought-4 Pokemon for my side (for switches) */
  myBrought: TeamPokemon[];
  /** My currently active Pokemon */
  myActive: ActivePokemon[];
  /** Whether this Pokemon has already mega-evolved */
  hasMegaEvolved: boolean;
  /** Full resolve context for damage previews. */
  myTeam?: TeamPokemon[];
  opponentTeam?: Partial<TeamPokemon>[];
  predictions?: PredictedSet[];
  fieldState?: Partial<FieldState>;
  format?: string;
  onAction: (action: TurnAction) => void;
  onClose: () => void;
}

export function ActionMenu({
  pokemon,
  slot,
  opponentActive,
  myBrought,
  myActive,
  hasMegaEvolved,
  myTeam = [],
  opponentTeam = [],
  predictions,
  fieldState,
  format,
  onAction,
  onClose,
}: ActionMenuProps) {
  const [phase, setPhase] = useState<MenuPhase>("moves");
  const [selectedMove, setSelectedMove] = useState<string | null>(null);
  const [megaWithMove, setMegaWithMove] = useState(false);
  /** When true, the next move selection fires as a Mega move. Toggled by
   *  the "Mega Evolve" button above the move grid. */
  const [megaPrimed, setMegaPrimed] = useState(false);
  const [targetSide, setTargetSide] = useState<Side | null>(null);
  const [targetSlot, setTargetSlot] = useState<Slot | null>(null);
  /** Remaining opponent slots to prompt for damage during a spread move. */
  const [spreadQueue, setSpreadQueue] = useState<Slot[]>([]);
  /** Has the Mega trigger already been recorded? Only the first action in
   *  a spread gets megaEvolved=true — we don't double-count it. */
  const [spreadMegaApplied, setSpreadMegaApplied] = useState(false);

  // Can Mega Evolve if the held item is that species' Mega Stone and
  // this Pokemon hasn't Mega'd yet. The legacy `pokemon.megaEvolution`
  // field is unused by the team builder, so derive from the item.
  const canMega =
    !hasMegaEvolved && Boolean(getMegaFormFor(pokemon.species, pokemon.item));

  // Pre-compute damage previews for the target phase.
  const oppPreviews = useMemo<Map<string, DamagePreview | null>>(() => {
    const map = new Map<string, DamagePreview | null>();
    if (!selectedMove) return map;
    const ctx = { myTeam, opponentTeam, predictions, format };
    const myActiveThis = myActive[slot - 1];
    const attackerBoosts = myActiveThis?.boosts ?? undefined;
    for (const opp of opponentActive) {
      if (opp.hpPercent <= 0) continue;
      const defender = resolveToTeamPokemon(opp, "p2", ctx);
      map.set(
        opp.species,
        getDamagePreview(
          pokemon,
          defender,
          selectedMove,
          fieldState,
          attackerBoosts,
          opp.boosts,
        ),
      );
    }
    return map;
  }, [selectedMove, pokemon, opponentActive, myActive, slot, myTeam, opponentTeam, predictions, format, fieldState]);

  // ----- Move selection -----
  const handleMoveSelect = (move: string, withMega: boolean) => {
    setSelectedMove(move);
    setMegaWithMove(withMega);

    const moveData = getMove(move);

    // No-target move (Protect, Swords Dance, Tailwind, Trick Room,
    // Rain Dance, Stealth Rock, etc.) — skip target + damage entirely
    // and emit the action immediately.
    if (moveData && NO_TARGET_TARGETS.has(moveData.target)) {
      const action: TurnAction = {
        side: "p1",
        slot,
        actionType: withMega ? "mega_move" : "move",
        moveName: move,
        megaEvolved: withMega,
      };
      onAction(action);
      onClose();
      return;
    }

    // Spread-move detection: skip single-target phase and queue every
    // live opponent for sequential damage logging.
    const isSpread = moveData && SPREAD_TARGETS.has(moveData.target);
    if (isSpread) {
      const liveOpps = opponentActive
        .map((opp, i) => ({ opp, slot: (i + 1) as Slot }))
        .filter(({ opp }) => opp.hpPercent > 0)
        .map(({ slot }) => slot);
      if (liveOpps.length === 0) {
        // Nothing to hit — bail back to the move grid.
        setSelectedMove(null);
        return;
      }
      setSpreadQueue(liveOpps);
      setSpreadMegaApplied(false);
      setTargetSide("p2");
      setTargetSlot(liveOpps[0]);
      setPhase("spread-damage");
      return;
    }
    setPhase("target");
  };

  // ----- Target selection -----
  const handleTargetSelect = (side: Side, tSlot: Slot) => {
    setTargetSide(side);
    setTargetSlot(tSlot);
    setPhase("damage");
  };

  const handleSpreadTarget = () => {
    // Spread move — target both opponents. We'll record target as opponent slot 1
    // with a convention that "spread" hits both. For simplicity, target slot 1.
    setTargetSide("p2");
    setTargetSlot(1);
    setPhase("damage");
  };

  /**
   * Build a TurnAction from a damage-input result against the current
   * targetSide/targetSlot.
   */
  const buildActionFromDamage = (
    r: DamageInputResult,
    overrides: Partial<TurnAction> = {},
  ): TurnAction | null => {
    if (!selectedMove || !targetSide || !targetSlot) return null;
    const statChanges: StatChange[] = [
      ...r.targetStatChanges.map((sc) => ({
        side: targetSide,
        slot: targetSlot,
        stat: sc.stat,
        delta: sc.delta,
      })),
      ...r.selfStatChanges.map((sc) => ({
        side: "p1" as Side,
        slot,
        stat: sc.stat,
        delta: sc.delta,
      })),
    ];
    return {
      side: "p1",
      slot,
      actionType: megaWithMove ? "mega_move" : "move",
      moveName: selectedMove,
      targetSide,
      targetSlot,
      damageDealtPercent: r.damage,
      wasCriticalHit: r.wasCrit,
      wasKo: r.wasKo,
      wasMiss: r.wasMiss,
      causedFlinch: r.causedFlinch,
      inflictedStatus: r.inflictedStatus,
      removedItem: r.removedItem,
      statChanges: statChanges.length > 0 ? statChanges : undefined,
      megaEvolved: megaWithMove,
      ...overrides,
    };
  };

  // ----- Single-target damage confirmation -----
  const handleDamageConfirm = (r: DamageInputResult) => {
    const action = buildActionFromDamage(r);
    if (!action) return;
    onAction(action);
    onClose();
  };

  // ----- Spread damage — fire one action per queued target, then close -----
  const handleSpreadDamageConfirm = (r: DamageInputResult) => {
    // Only the FIRST spread action carries megaEvolved — subsequent
    // hits share the same Mega Evolve event.
    const action = buildActionFromDamage(r, {
      megaEvolved: megaWithMove && !spreadMegaApplied,
      actionType: megaWithMove && !spreadMegaApplied ? "mega_move" : "move",
    });
    if (!action) return;
    onAction(action);

    const remaining = spreadQueue.slice(1);
    if (remaining.length === 0) {
      onClose();
      return;
    }
    setSpreadQueue(remaining);
    setSpreadMegaApplied(true);
    setTargetSlot(remaining[0]);
  };

  // ----- Switch -----
  const handleSwitchSelect = (newSpecies: string) => {
    const action: TurnAction = {
      side: "p1",
      slot,
      actionType: "switch",
      switchOutSpecies: pokemon.species,
      switchInSpecies: newSpecies,
    };
    onAction(action);
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">
          {pokemon.species}
          {phase !== "moves" && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {phase === "target" && `- ${selectedMove}`}
              {phase === "damage" && `- ${selectedMove}`}
              {phase === "switch" && "- Switch"}
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Phase: Move selection */}
      {phase === "moves" && (
        <div className="space-y-3">
          {/* Mega Evolve toggle — sits above the moves so it clearly
              modifies whatever the user taps next. Only rendered when
              the held item is a valid Mega Stone for this species. */}
          {canMega && (
            <button
              type="button"
              onClick={() => setMegaPrimed((v) => !v)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors cursor-pointer ${
                megaPrimed
                  ? "border-warning bg-warning/15 text-warning"
                  : "border-warning/40 bg-warning/5 text-warning hover:bg-warning/10"
              }`}
              title="Next move will trigger Mega Evolution"
            >
              <span className="font-semibold">
                {megaPrimed ? "✓ Mega Evolve + next move" : "Mega Evolve with this move"}
              </span>
              <span className="text-[10px] uppercase tracking-wider opacity-80">
                {megaPrimed ? "primed" : "tap to arm"}
              </span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            {pokemon.moves.map((move) => {
              if (!move) return null;
              return (
                <Button
                  key={move}
                  variant="outline"
                  size="lg"
                  className={`w-full justify-center text-sm font-medium ${
                    megaPrimed
                      ? "border-warning/60 text-warning hover:bg-warning/10"
                      : ""
                  }`}
                  onClick={() => handleMoveSelect(move, megaPrimed)}
                >
                  {megaPrimed ? `⚡ ${move}` : move}
                </Button>
              );
            })}
          </div>

          {/* Switch button */}
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => setPhase("switch")}
          >
            Switch Out
          </Button>
        </div>
      )}

      {/* Phase: Target selection (with damage previews) */}
      {phase === "target" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Select target:</p>
          <div className="grid grid-cols-1 gap-2">
            {opponentActive.map((opp, i) => {
              const preview = oppPreviews.get(opp.species) ?? null;
              return (
                <Button
                  key={opp.species}
                  variant="outline"
                  size="lg"
                  className="w-full justify-between border-destructive/30 hover:bg-destructive/10"
                  disabled={opp.hpPercent <= 0}
                  onClick={() => handleTargetSelect("p2", (i + 1) as Slot)}
                >
                  <span>
                    {opp.species}
                    {opp.hpPercent <= 0 ? " (KO)" : ""}
                  </span>
                  {preview && opp.hpPercent > 0 && (
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
            onClick={handleSpreadTarget}
          >
            Spread (hits both)
          </Button>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPhase("moves")}
            >
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

      {/* Phase: Damage input */}
      {phase === "damage" && targetSlot && targetSide && (
        <DamageInput
          targetName={
            targetSide === "p2"
              ? opponentActive[targetSlot - 1]?.species ?? "Target"
              : myActive[targetSlot - 1]?.species ?? "Target"
          }
          onConfirm={handleDamageConfirm}
          onCancel={() => setPhase("target")}
        />
      )}

      {/* Phase: Spread damage — sequential per-opponent prompts */}
      {phase === "spread-damage" && targetSlot && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Spread move — damage vs{" "}
              <span className="font-semibold text-foreground">
                {opponentActive[targetSlot - 1]?.species ?? "opponent"}
              </span>
            </span>
            <span className="text-[10px] font-mono">
              {spreadQueue.length} target{spreadQueue.length !== 1 ? "s" : ""} left
            </span>
          </div>
          <DamageInput
            targetName={opponentActive[targetSlot - 1]?.species ?? "Target"}
            onConfirm={handleSpreadDamageConfirm}
            onCancel={() => {
              // Bail out of the spread entirely.
              setSpreadQueue([]);
              setPhase("moves");
            }}
          />
        </div>
      )}

      {/* Phase: Switch */}
      {phase === "switch" && (
        <SwitchSelector
          brought={myBrought}
          active={myActive}
          switchOutSpecies={pokemon.species}
          onSelect={handleSwitchSelect}
          onCancel={() => setPhase("moves")}
        />
      )}
    </div>
  );
}
