/**
 * Move lookup and species learnset utilities.
 */
import { Dex } from "@pkmn/dex";
import { defaultGen } from "./generations";

export interface MoveData {
  name: string;
  type: string;
  basePower: number;
  category: string;
  priority: number;
  pp: number;
  target: string;
  description: string;
}

type MoveLike = {
  name: string;
  type: string;
  basePower: number;
  category: string;
  priority: number;
  pp: number;
  target: string;
  shortDesc?: string;
  desc?: string;
} | null | undefined;

/**
 * Get move data by name. Returns null if not found.
 * Falls back to the full @pkmn/dex catalog when the Gen 9 view doesn't
 * contain the move (same reason as species/abilities).
 */
export function getMove(name: string): MoveData | null {
  const move =
    ((defaultGen.moves.get(name) as MoveLike) ??
      (Dex.moves.get(name) as MoveLike));
  if (!move) return null;

  return {
    name: move.name,
    type: move.type,
    basePower: move.basePower,
    category: move.category,
    priority: move.priority,
    pp: move.pp,
    target: move.target,
    description: move.shortDesc || move.desc || "",
  };
}

/**
 * Get all legal moves for a species (via learnsets).
 * Returns an array of move names. Returns empty array if learnset unavailable.
 */
export async function getMovesForSpecies(
  speciesName: string,
): Promise<string[]> {
  // Gen 9 learnset is preferred, but falls back to the full Dex learnset
  // for Pokemon cut from SV (Starmie, Togekiss, etc.) whose learnset still
  // exists in the broader dataset.
  const moveIds = new Set<string>();

  const gen9Learnable = await defaultGen.learnsets.learnable(speciesName);
  if (gen9Learnable) {
    for (const id of Object.keys(gen9Learnable)) moveIds.add(id);
  }

  if (moveIds.size === 0) {
    const dexLearnset = await Dex.learnsets.get(speciesName);
    if (dexLearnset?.learnset) {
      for (const id of Object.keys(dexLearnset.learnset)) moveIds.add(id);
    }
  }

  if (moveIds.size === 0) return [];

  const moveNames: string[] = [];
  for (const moveId of moveIds) {
    const move = getMove(moveId);
    if (move) moveNames.push(move.name);
  }

  return moveNames.sort();
}
