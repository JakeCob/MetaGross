/**
 * Meta-team shared types.
 *
 * Mirrors the Drizzle `metaTeams` row with JSON columns decoded.
 */

export type MetaTeamSource =
  | "pikalytics"
  | "limitless"
  | "smogon"
  | "reddit"
  | "user"
  | "creator"
  | "vgcpastes";

export interface MetaTeamPokemon {
  species: string;
  ability?: string;
  item?: string;
  nature?: string;
  moves?: string[];
  teraType?: string;
  /** Formatted EV string ("252 HP / 252 Atk / 4 SpD"). Optional; present
   *  on creator teams where Wolfe / etc. published the exact numbers. */
  evs?: string;
  /** Formatted IV string ("0 Atk / 0 Spe"). Optional. */
  ivs?: string;
}

export interface MetaTeam {
  id: string;
  source: MetaTeamSource;
  sourceRef: string | null;
  sourceUrl: string | null;
  format: string;
  author: string | null;
  record: string | null;
  archetype: string | null;
  description: string | null;
  speciesFingerprint: string;
  species: string[];
  pokemon: MetaTeamPokemon[];
  trust: number;
  seenAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/** Ranked match result returned by the matcher. */
export interface MetaTeamMatch {
  team: MetaTeam;
  /** How many of the entered species matched. */
  overlap: number;
  /** Score 0-1 combining overlap, trust, and recency. */
  score: number;
  /** Species on the team that the user hasn't entered yet — the "fill" set. */
  missing: string[];
}
