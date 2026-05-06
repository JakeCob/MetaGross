import { eq, and, inArray } from 'drizzle-orm';
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
  description: string | null;
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
export async function getAllTeams(
  userId: string = DEFAULT_USER_ID,
): Promise<TeamWithPokemon[]> {
  const teamRows = await db
    .select()
    .from(teams)
    .where(eq(teams.userId, userId))
    .all();

  if (teamRows.length === 0) return [];

  const teamIds = teamRows.map((t) => t.id);
  const allPokemon = await db
    .select()
    .from(teamPokemon)
    .where(inArray(teamPokemon.teamId, teamIds))
    .orderBy(teamPokemon.slot)
    .all();

  const pokemonByTeam = new Map<string, TeamPokemonRow[]>();
  for (const mon of allPokemon) {
    const tid = mon.teamId ?? '';
    if (!pokemonByTeam.has(tid)) pokemonByTeam.set(tid, []);
    pokemonByTeam.get(tid)!.push(mon);
  }

  return teamRows.map((team) => ({
    ...team,
    pokemon: pokemonByTeam.get(team.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// getTeamById
// ---------------------------------------------------------------------------
export async function getTeamById(
  id: string,
): Promise<TeamWithPokemon | null> {
  const team = await db
    .select()
    .from(teams)
    .where(eq(teams.id, id))
    .get();

  if (!team) return null;

  const pokemon = await db
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
  description?: string;
  notes?: string;
  pokemon: TeamPokemonInput[];
}

export async function createTeam(
  data: CreateTeamInput,
): Promise<TeamWithPokemon> {
  const userId = data.userId ?? DEFAULT_USER_ID;
  const now = Date.now();

  return db.transaction(async (tx) => {
    const insertedTeam = await tx
      .insert(teams)
      .values({
        userId,
        name: data.name,
        format: data.format,
        pokepaste: data.pokepaste ?? null,
        description: data.description ?? null,
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
      const inserted = await tx
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
  description?: string | null;
  notes?: string | null;
  isActive?: number;
  pokemon?: TeamPokemonInput[];
}

export async function updateTeam(
  id: string,
  data: UpdateTeamInput,
): Promise<TeamWithPokemon | null> {
  const existing = await getTeamById(id);
  if (!existing) return null;

  const now = Date.now();

  return db.transaction(async (tx) => {
    const teamUpdate: Record<string, unknown> = { updatedAt: now };
    if (data.name !== undefined) teamUpdate.name = data.name;
    if (data.format !== undefined) teamUpdate.format = data.format;
    if (data.pokepaste !== undefined) teamUpdate.pokepaste = data.pokepaste;
    if (data.description !== undefined) teamUpdate.description = data.description;
    if (data.notes !== undefined) teamUpdate.notes = data.notes;
    if (data.isActive !== undefined) teamUpdate.isActive = data.isActive;

    await tx.update(teams).set(teamUpdate).where(eq(teams.id, id)).run();

    if (data.pokemon !== undefined) {
      await tx.delete(teamPokemon).where(eq(teamPokemon.teamId, id)).run();

      for (let i = 0; i < data.pokemon.length; i++) {
        const mon = data.pokemon[i];
        await tx
          .insert(teamPokemon)
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

    const updated = (await tx
      .select()
      .from(teams)
      .where(eq(teams.id, id))
      .get())!;
    const pokemon = await tx
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
export async function deleteTeam(id: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(teams)
    .where(eq(teams.id, id))
    .get();
  if (!existing) return false;

  await db.transaction(async (tx) => {
    await tx.delete(teamPokemon).where(eq(teamPokemon.teamId, id)).run();
    await tx.delete(teams).where(eq(teams.id, id)).run();
  });

  return true;
}

// ---------------------------------------------------------------------------
// setActiveTeam
// ---------------------------------------------------------------------------
export async function setActiveTeam(
  userId: string = DEFAULT_USER_ID,
  teamId: string,
): Promise<TeamWithPokemon | null> {
  const team = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.userId, userId)))
    .get();

  if (!team) return null;

  await db.transaction(async (tx) => {
    await tx
      .update(teams)
      .set({ isActive: 0, updatedAt: Date.now() })
      .where(eq(teams.userId, userId))
      .run();

    await tx
      .update(teams)
      .set({ isActive: 1, updatedAt: Date.now() })
      .where(eq(teams.id, teamId))
      .run();
  });

  return getTeamById(teamId);
}
