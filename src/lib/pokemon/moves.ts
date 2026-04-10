/**
 * Move lookup and species learnset utilities.
 */
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

/**
 * Get move data by name. Returns null if not found.
 */
export function getMove(name: string): MoveData | null {
  const move = defaultGen.moves.get(name);
  if (!move) return null;

  return {
    name: move.name,
    type: move.type,
    basePower: move.basePower,
    category: move.category,
    priority: move.priority,
    pp: move.pp,
    target: move.target,
    description: move.shortDesc || move.desc,
  };
}

/**
 * Get all legal moves for a species (via learnsets).
 * Returns an array of move names. Returns empty array if learnset unavailable.
 */
export async function getMovesForSpecies(
  speciesName: string,
): Promise<string[]> {
  const learnable = await defaultGen.learnsets.learnable(speciesName);
  if (!learnable) return [];

  const moveNames: string[] = [];
  for (const moveId of Object.keys(learnable)) {
    const move = defaultGen.moves.get(moveId);
    if (move) {
      moveNames.push(move.name);
    }
  }

  return moveNames.sort();
}
