/**
 * Extract SpeedObservation[] and DamageObservation[] from the battle
 * logger's turn history.
 *
 * These feed directly into predictEVs (src/lib/ev/reverse-calc.ts) to
 * infer the opponent's EV spread / nature from what the user observed
 * during the match. The richer the turn data (more logged actions with
 * moveOrder + damage %), the tighter the prediction.
 */

import type { Turn, TurnAction, FieldState, ActivePokemon } from "@/lib/types/battle";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { DamageObservation, SpeedObservation } from "@/lib/types/ev";
import { getEffectiveSpeed } from "@/lib/engine/speed-calc";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CollectedObservations {
  speed: SpeedObservation[];
  damage: DamageObservation[];
}

/**
 * Walk every turn in the match history and extract observations about
 * opponent Pokemon.
 *
 * @param turns         Committed turns from the battle logger store.
 * @param myTeam        Your full team (used to compute exact effective speed).
 * @param opponentTeam  Opponent's team snapshot (partial; ability/item may
 *                      have been filled in via reveals).
 */
export function collectObservations(
  turns: Turn[],
  myTeam: TeamPokemon[],
  opponentTeam: Partial<TeamPokemon>[],
): CollectedObservations {
  const speed: SpeedObservation[] = [];
  const damage: DamageObservation[] = [];

  for (const turn of turns) {
    collectSpeedFromTurn(turn, myTeam, speed);
    collectDamageFromTurn(turn, myTeam, opponentTeam, damage);
  }

  return { speed, damage };
}

// ---------------------------------------------------------------------------
// Speed observations
// ---------------------------------------------------------------------------

/**
 * If a turn has at least one p1 move and one p2 move, both with
 * `moveOrder` set, we can determine who moved first.
 *
 * For each (p2 move, p1 move) pair in the same turn, emit a
 * SpeedObservation with:
 *   pokemonA = the opponent's species (the unknown)
 *   pokemonB = my species (the reference, known speed)
 *   aMovedFirst = true when the opponent's moveOrder < mine
 *   knownSpeedB = my exact effective speed in the turn's field state
 */
function collectSpeedFromTurn(
  turn: Turn,
  myTeam: TeamPokemon[],
  out: SpeedObservation[],
): void {
  const p1Moves = turn.actions.filter(
    (a) => a.side === "p1" && (a.actionType === "move" || a.actionType === "mega_move") && a.moveOrder != null,
  );
  const p2Moves = turn.actions.filter(
    (a) => a.side === "p2" && (a.actionType === "move" || a.actionType === "mega_move") && a.moveOrder != null,
  );

  if (p1Moves.length === 0 || p2Moves.length === 0) return;

  const fieldState = turn.fieldState;
  const trickRoom = fieldState?.trickRoom ?? false;

  for (const p2a of p2Moves) {
    for (const p1a of p1Moves) {
      const oppSpecies = resolveSpeciesFromAction(p2a, turn.activeP2);
      const mySpecies = resolveSpeciesFromAction(p1a, turn.activeP1);
      if (!oppSpecies || !mySpecies) continue;

      const myTeamPokemon = myTeam.find((p) => p.species === mySpecies);
      if (!myTeamPokemon) continue;

      const mySpeed = getEffectiveSpeed(
        myTeamPokemon,
        fieldState ?? ({} as FieldState),
        null,
        "p1",
      );

      out.push({
        pokemonA: oppSpecies,
        pokemonB: mySpecies,
        aMovedFirst: (p2a.moveOrder ?? 999) < (p1a.moveOrder ?? 999),
        knownSpeedB: mySpeed,
        fieldState: {
          trickRoom,
          tailwind: fieldState?.tailwindP1
            ? "b"
            : fieldState?.tailwindP2
              ? "a"
              : null,
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Damage observations
// ---------------------------------------------------------------------------

/**
 * When the opponent deals damage to my Pokemon, we can observe the %
 * and reverse-calc the opponent's offensive EV investment.
 *
 * We also emit damage obs for MY attacks on the opponent (helps infer
 * their defensive EVs).
 */
function collectDamageFromTurn(
  turn: Turn,
  myTeam: TeamPokemon[],
  opponentTeam: Partial<TeamPokemon>[],
  out: DamageObservation[],
): void {
  const fieldState = turn.fieldState;

  for (const action of turn.actions) {
    if (
      action.actionType !== "move" &&
      action.actionType !== "mega_move"
    )
      continue;
    if (!action.moveName || action.damageDealtPercent == null) continue;
    if (action.wasCriticalHit) continue; // crits are unreliable for reverse-calc

    if (action.side === "p2" && action.targetSide === "p1") {
      // Opponent attacked my Pokemon → infer their offensive EVs.
      const oppSpecies = resolveSpeciesFromAction(action, turn.activeP2);
      const mySpecies = action.targetSlot
        ? turn.activeP1[action.targetSlot - 1]?.species
        : null;
      if (!oppSpecies || !mySpecies) continue;

      const myPokemon = myTeam.find((p) => p.species === mySpecies);
      if (!myPokemon) continue;

      out.push({
        attackerSpecies: oppSpecies,
        attackerAbility: opponentTeam.find((p) => p.species === oppSpecies)?.ability ?? undefined,
        attackerItem: opponentTeam.find((p) => p.species === oppSpecies)?.item ?? undefined,
        moveName: action.moveName,
        defenderSpecies: mySpecies,
        damagePercent: action.damageDealtPercent,
        fieldWeather: fieldState?.weather ?? undefined,
        fieldTerrain: fieldState?.terrain ?? undefined,
      });
    } else if (action.side === "p1" && action.targetSide === "p2") {
      // I attacked their Pokemon → infer their defensive EVs.
      const mySpecies = resolveSpeciesFromAction(action, turn.activeP1);
      const oppSpecies = action.targetSlot
        ? turn.activeP2[action.targetSlot - 1]?.species
        : null;
      if (!mySpecies || !oppSpecies) continue;

      const myPokemon = myTeam.find((p) => p.species === mySpecies);
      if (!myPokemon) continue;

      out.push({
        attackerSpecies: mySpecies,
        attackerAbility: myPokemon.ability,
        attackerItem: myPokemon.item,
        attackerEvs: myPokemon.evs,
        attackerNature: myPokemon.nature,
        moveName: action.moveName,
        defenderSpecies: oppSpecies,
        damagePercent: action.damageDealtPercent,
        fieldWeather: fieldState?.weather ?? undefined,
        fieldTerrain: fieldState?.terrain ?? undefined,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveSpeciesFromAction(
  action: TurnAction,
  active: ActivePokemon[],
): string | null {
  const idx = action.slot - 1;
  return active[idx]?.species ?? null;
}
