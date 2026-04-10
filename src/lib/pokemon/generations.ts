/**
 * Initialize @pkmn/dex + @pkmn/data and export shared generation instances.
 */
import { Dex } from "@pkmn/dex";
import { Generations } from "@pkmn/data";

/** Generations instance wrapping the full dex data. */
export const generations = new Generations(Dex);

/** Default generation (Gen 9 / Scarlet & Violet). */
export const defaultGen = generations.get(9);
