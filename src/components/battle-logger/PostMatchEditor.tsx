"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useBattleLogger } from "@/stores/use-battle-logger";
import type { TurnAction, ActionType, Side, Slot } from "@/lib/types/battle";

interface TurnEntry {
  actions: TurnAction[];
}

export interface PostMatchEditorProps {
  onEndBattle: () => void;
}

export function PostMatchEditor({ onEndBattle }: PostMatchEditorProps) {
  const store = useBattleLogger();
  const [turnEntries, setTurnEntries] = useState<TurnEntry[]>([]);
  const [editingTurn, setEditingTurn] = useState<TurnEntry>({ actions: [] });

  // Action builder state
  const [actionSide, setActionSide] = useState<Side>("p1");
  const [actionSlot, setActionSlot] = useState<Slot>(1);
  const [actionType, setActionType] = useState<ActionType>("move");
  const [moveName, setMoveName] = useState("");
  const [targetSide, setTargetSide] = useState<Side>("p2");
  const [targetSlot, setTargetSlot] = useState<Slot>(1);
  const [damage, setDamage] = useState(0);
  const [wasKo, setWasKo] = useState(false);
  const [wasCrit, setWasCrit] = useState(false);
  const [switchIn, setSwitchIn] = useState("");

  const myBrought = store.myBrought;
  const oppBrought = store.opponentBrought;

  const getMoveOptions = useCallback(
    (side: Side, slot: Slot): string[] => {
      if (side === "p1") {
        // Get moves from my team for the active Pokemon
        const species = store.myLeads[slot - 1] ?? store.myBrought[slot - 1];
        const pokemon = store.myTeam.find((p) => p.species === species);
        return pokemon?.moves.filter(Boolean) ?? [];
      }
      return [];
    },
    [store.myTeam, store.myLeads, store.myBrought],
  );

  const handleAddAction = useCallback(() => {
    const action: TurnAction = {
      side: actionSide,
      slot: actionSlot,
      actionType,
    };

    if (actionType === "move" || actionType === "mega_move") {
      action.moveName = moveName || "Unknown Move";
      action.targetSide = targetSide;
      action.targetSlot = targetSlot;
      action.damageDealtPercent = damage;
      action.wasKo = wasKo;
      action.wasCriticalHit = wasCrit;
      if (actionType === "mega_move") {
        action.megaEvolved = true;
      }
    }

    if (actionType === "switch") {
      action.switchInSpecies = switchIn || "Unknown";
      action.switchOutSpecies =
        actionSide === "p1"
          ? store.myLeads[actionSlot - 1] ?? ""
          : store.opponentLeads[actionSlot - 1] ?? "";
    }

    setEditingTurn((prev) => ({
      actions: [...prev.actions, action],
    }));

    // Reset form
    setMoveName("");
    setDamage(0);
    setWasKo(false);
    setWasCrit(false);
    setSwitchIn("");
  }, [
    actionSide,
    actionSlot,
    actionType,
    moveName,
    targetSide,
    targetSlot,
    damage,
    wasKo,
    wasCrit,
    switchIn,
    store.myLeads,
    store.opponentLeads,
  ]);

  const handleCommitTurn = useCallback(() => {
    if (editingTurn.actions.length === 0) return;

    // Add each action to the store and commit
    for (const action of editingTurn.actions) {
      store.addAction(action);
    }
    store.commitTurn();

    setTurnEntries((prev) => [...prev, editingTurn]);
    setEditingTurn({ actions: [] });
  }, [editingTurn, store]);

  const handleRemoveAction = useCallback((idx: number) => {
    setEditingTurn((prev) => ({
      actions: prev.actions.filter((_, i) => i !== idx),
    }));
  }, []);

  const moveOptions = getMoveOptions(actionSide, actionSlot);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Post-Match Editor</h2>
          <p className="text-xs text-muted">Add turns from your battle replay</p>
        </div>
        <Button variant="destructive" size="sm" onClick={onEndBattle}>
          Done
        </Button>
      </div>

      {/* Completed turns summary */}
      {turnEntries.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted uppercase tracking-wider">
            Logged Turns
          </p>
          <div className="flex flex-wrap gap-1.5">
            {turnEntries.map((_, i) => (
              <Badge key={i} variant="default" className="text-[10px]">
                Turn {i + 1} ({turnEntries[i].actions.length} actions)
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Current turn being built */}
      <div className="rounded-xl border border-card-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            Turn {turnEntries.length + 1}
          </p>
          <span className="text-xs text-muted">
            {editingTurn.actions.length} action{editingTurn.actions.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Current turn actions */}
        {editingTurn.actions.length > 0 && (
          <div className="space-y-1">
            {editingTurn.actions.map((action, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-background/50 px-2 py-1"
              >
                <span className="text-xs text-foreground">
                  {action.side === "p1" ? "My" : "Opp"} slot {action.slot}:{" "}
                  {action.actionType === "switch"
                    ? `Switch to ${action.switchInSpecies}`
                    : action.moveName ?? "Unknown"}
                  {action.damageDealtPercent
                    ? ` (${action.damageDealtPercent}%)`
                    : ""}
                  {action.wasKo ? " KO" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveAction(i)}
                  className="text-muted hover:text-destructive transition-colors cursor-pointer p-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
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
            ))}
          </div>
        )}

        {/* Action builder form */}
        <div className="space-y-3 border-t border-card-border pt-3">
          <p className="text-xs font-medium text-muted">Add Action</p>

          <div className="grid grid-cols-3 gap-2">
            <Select
              label="Side"
              value={actionSide}
              onChange={(e) => setActionSide(e.target.value as Side)}
            >
              <option value="p1">My</option>
              <option value="p2">Opp</option>
            </Select>

            <Select
              label="Slot"
              value={actionSlot}
              onChange={(e) => setActionSlot(Number(e.target.value) as Slot)}
            >
              <option value={1}>Slot 1</option>
              <option value={2}>Slot 2</option>
            </Select>

            <Select
              label="Type"
              value={actionType}
              onChange={(e) => setActionType(e.target.value as ActionType)}
            >
              <option value="move">Move</option>
              <option value="mega_move">Mega+Move</option>
              <option value="switch">Switch</option>
              <option value="nothing">Nothing</option>
            </Select>
          </div>

          {/* Move fields */}
          {(actionType === "move" || actionType === "mega_move") && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {actionSide === "p1" && moveOptions.length > 0 ? (
                  <Select
                    label="Move"
                    value={moveName}
                    onChange={(e) => setMoveName(e.target.value)}
                  >
                    <option value="">Select move</option>
                    {moveOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">
                      Move
                    </label>
                    <input
                      type="text"
                      value={moveName}
                      onChange={(e) => setMoveName(e.target.value)}
                      placeholder="Move name"
                      className="h-10 w-full rounded-lg border border-card-border bg-card px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Select
                    label="Target"
                    value={targetSide}
                    onChange={(e) => setTargetSide(e.target.value as Side)}
                  >
                    <option value="p1">My</option>
                    <option value="p2">Opp</option>
                  </Select>
                  <Select
                    label="Slot"
                    value={targetSlot}
                    onChange={(e) =>
                      setTargetSlot(Number(e.target.value) as Slot)
                    }
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                  </Select>
                </div>
              </div>

              <Slider
                label="Damage %"
                min={0}
                max={100}
                value={damage}
                onChange={(e) => setDamage(Number(e.target.value))}
              />

              <div className="flex gap-2">
                <Button
                  variant={wasKo ? "destructive" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setWasKo(!wasKo);
                    if (!wasKo) setDamage(100);
                  }}
                >
                  KO
                </Button>
                <Button
                  variant={wasCrit ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setWasCrit(!wasCrit)}
                >
                  Crit
                </Button>
              </div>
            </div>
          )}

          {/* Switch fields */}
          {actionType === "switch" && (
            <Select
              label="Switch to"
              value={switchIn}
              onChange={(e) => setSwitchIn(e.target.value)}
            >
              <option value="">Select Pokemon</option>
              {(actionSide === "p1" ? myBrought : oppBrought).map((species) => (
                <option key={species} value={species}>
                  {species}
                </option>
              ))}
            </Select>
          )}

          <Button
            size="sm"
            className="w-full"
            onClick={handleAddAction}
            disabled={
              (actionType === "move" && !moveName) ||
              (actionType === "mega_move" && !moveName) ||
              (actionType === "switch" && !switchIn)
            }
          >
            Add Action
          </Button>
        </div>
      </div>

      {/* Commit turn */}
      <Button
        size="lg"
        className="w-full"
        onClick={handleCommitTurn}
        disabled={editingTurn.actions.length === 0}
      >
        Save Turn {turnEntries.length + 1}
      </Button>
    </div>
  );
}
