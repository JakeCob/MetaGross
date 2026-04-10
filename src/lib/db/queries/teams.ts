import { eq, and } from 'drizzle-orm';
import { db } from '../index';
import { teams, teamPokemon } from '../schema';
import type { TeamPokemonInput } from '../../validation/team';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// Shape returned to the API layer
// ---------------------------------------------------------------------------
export interface TeamRow {
  id: string;
  userId: string | null;
  name: string;
  format: string | null;
  isActive: number | null;
  pokepaste: string | null;
  notes: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface TeamPokemonRow {
  id: string;
  teamId: string | null;
  slot: number | null;
  species: string;
  ability: string;
  item: string | null;
  nature: string | null;
  level: number | null;
  megaEvolution: string | null;
  teraType: string | null;
  moves: unknown;
  evs: unknown;
  ivs: unknown;
  createdAt: number | null;
}

export interface TeamWithPokemon extends TeamRow {
  pokemon: TeamPokemonRow[];
}

// ---------------------------------------------------------------------------
// getAllTeams
// ---------------------------------------------------------------------------
export function getAllTeams(userId: string = DEFAULT_USER_ID): TeamWithPokemon[] {
  const teamRows = db
    .select()
    .from(teams)
    .where(eq(teams.userId, userId))
    .all();

  return teamRows.map((team) => {
    const pokemon = db
      .select()
      .from(teamPokemon)
      .where(eq(teamPokemon.teamId, team.id))
      .orderBy(teamPokemon.slot)
      .all();

    return { ...team, pokemon };
  });
}

// ---------------------------------------------------------------------------
// getTeamById
// ---------------------------------------------------------------------------
export function getTeamById(id: string): TeamWithPokemon | null {
  const team = db
    .select()
    .from(teams)
    .where(eq(teams.id, id))
    .get();

  if (!team) return null;

  const pokemon = db
    .select()
    .from(teamPokemon)
    .where(eq(teamPokemon.teamId, id))
    .orderBy(teamPokemon.slot)
    .all();

  return { ...team, pokemon };
}

// ---------------------------------------------------------------------------
// createTeam
// ---------------------------------------------------------------------------
export interface CreateTeamInput {
  name: string;
  format: string;
  userId?: string;
  pokepaste?: string;
  notes?: string;
  pokemon: TeamPokemonInput[];
}

export function createTeam(data: CreateTeamInput): TeamWithPokemon {
  const userId = data.userId ?? DEFAULT_USER_ID;
  const now = Date.now();

  return db.transaction((tx) => {
    const insertedTeam = tx
      .insert(teams)
      .values({
        userId,
        name: data.name,
        format: data.format,
        pokepaste: data.pokepaste ?? null,
        notes: data.notes ?? null,
        isActive: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    const pokemonRows: TeamPokemonRow[] = [];

    for (let i = 0; i < data.pokemon.length; i++) {
      const mon = data.pokemon[i];
      const inserted = tx
        .insert(teamPokemon)
        .values({
          teamId: insertedTeam.id,
          slot: i + 1,
          species: mon.species,
          ability: mon.ability,
          item: mon.item ?? null,
          nature: mon.nature,
          level: mon.level,
          megaEvolution: mon.megaEvolution ?? null,
          teraType: mon.teraType ?? null,
          moves: mon.moves as unknown,
          evs: mon.evs as unknown,
          ivs: mon.ivs as unknown,
          createdAt: now,
        })
        .returning()
        .get();

      pokemonRows.push(inserted);
    }

    return { ...insertedTeam, pokemon: pokemonRows };
  });
}

// ---------------------------------------------------------------------------
// updateTeam
// ---------------------------------------------------------------------------
export interface UpdateTeamInput {
  name?: string;
  format?: string;
  pokepaste?: string | null;
  notes?: string | null;
  isActive?: number;
  pokemon?: TeamPokemonInput[];
}

export function updateTeam(id: string, data: UpdateTeamInput): TeamWithPokemon | null {
  const existing = getTeamById(id);
  if (!existing) return null;

  const now = Date.now();

  return db.transaction((tx) => {
    // Build the set of fields to update on the teams table
    const teamUpdate: Record<string, unknown> = { updatedAt: now };
    if (data.name !== undefined) teamUpdate.name = data.name;
    if (data.format !== undefined) teamUpdate.format = data.format;
    if (data.pokepaste !== undefined) teamUpdate.pokepaste = data.pokepaste;
    if (data.notes !== undefined) teamUpdate.notes = data.notes;
    if (data.isActive !== undefined) teamUpdate.isActive = data.isActive;

    tx.update(teams).set(teamUpdate).where(eq(teams.id, id)).run();

    // If pokemon array is provided, replace all pokemon
    if (data.pokemon !== undefined) {
      tx.delete(teamPokemon).where(eq(teamPokemon.teamId, id)).run();

      for (let i = 0; i < data.pokemon.length; i++) {
        const mon = data.pokemon[i];
        tx.insert(teamPokemon)
          .values({
            teamId: id,
            slot: i + 1,
            species: mon.species,
            ability: mon.ability,
            item: mon.item ?? null,
            nature: mon.nature,
            level: mon.level,
            megaEvolution: mon.megaEvolution ?? null,
            teraType: mon.teraType ?? null,
            moves: mon.moves as unknown,
            evs: mon.evs as unknown,
            ivs: mon.ivs as unknown,
            createdAt: now,
          })
          .run();
      }
    }

    // Re-fetch and return the complete updated team
    const updated = tx.select().from(teams).where(eq(teams.id, id)).get()!;
    const pokemon = tx
      .select()
      .from(teamPokemon)
      .where(eq(teamPokemon.teamId, id))
      .orderBy(teamPokemon.slot)
      .all();

    return { ...updated, pokemon };
  });
}

// ---------------------------------------------------------------------------
// deleteTeam
// ---------------------------------------------------------------------------
export function deleteTeam(id: string): boolean {
  const existing = db.select().from(teams).where(eq(teams.id, id)).get();
  if (!existing) return false;

  db.transaction((tx) => {
    tx.delete(teamPokemon).where(eq(teamPokemon.teamId, id)).run();
    tx.delete(teams).where(eq(teams.id, id)).run();
  });

  return true;
}

// ---------------------------------------------------------------------------
// setActiveTeam
// ---------------------------------------------------------------------------
export function setActiveTeam(
  userId: string = DEFAULT_USER_ID,
  teamId: string,
): TeamWithPokemon | null {
  const team = db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.userId, userId)))
    .get();

  if (!team) return null;

  db.transaction((tx) => {
    // Deactivate all teams for this user
    tx.update(teams)
      .set({ isActive: 0, updatedAt: Date.now() })
      .where(eq(teams.userId, userId))
      .run();

    // Activate the target team
    tx.update(teams)
      .set({ isActive: 1, updatedAt: Date.now() })
      .where(eq(teams.id, teamId))
      .run();
  });

  return getTeamById(teamId);
}
