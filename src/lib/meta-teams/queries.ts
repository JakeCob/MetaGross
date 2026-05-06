/**
 * Meta-teams DB access — insert, lookup, match.
 */
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { metaTeams } from "@/lib/db/schema";
import {
  buildFingerprint,
  countOverlap,
  normalizeSpeciesForFingerprint,
} from "./fingerprint";
import type { MetaTeam, MetaTeamMatch, MetaTeamSource } from "./types";

export interface UpsertMetaTeamInput {
  source: MetaTeamSource;
  sourceRef?: string | null;
  sourceUrl?: string | null;
  format?: string;
  author?: string | null;
  record?: string | null;
  archetype?: string | null;
  description?: string | null;
  species: string[];
  pokemon?: Array<{
    species: string;
    ability?: string;
    item?: string;
    nature?: string;
    moves?: string[];
    teraType?: string;
    evs?: string;
    ivs?: string;
  }>;
  trust?: number;
  seenAt?: number | null;
}

export async function upsertMetaTeam(
  input: UpsertMetaTeamInput,
): Promise<MetaTeam> {
  const fingerprint = buildFingerprint(input.species);
  if (!fingerprint) {
    throw new Error("Cannot upsert meta team with empty species list");
  }

  const format = input.format ?? "champions-reg-m-a";
  const now = Date.now();

  const existing = await db
    .select()
    .from(metaTeams)
    .where(
      and(
        eq(metaTeams.speciesFingerprint, fingerprint),
        eq(metaTeams.source, input.source),
      ),
    )
    .limit(1)
    .all();

  if (existing.length > 0) {
    const prev = existing[0];
    const prevTrust = prev.trust ?? 0;
    const nextTrust = Math.max(prevTrust, input.trust ?? 0.5);
    const nextSeenAt = Math.max(prev.seenAt ?? 0, input.seenAt ?? 0) || null;

    const updated = await db
      .update(metaTeams)
      .set({
        sourceRef: input.sourceRef ?? prev.sourceRef,
        sourceUrl: input.sourceUrl ?? prev.sourceUrl,
        author: input.author ?? prev.author,
        record: input.record ?? prev.record,
        archetype: input.archetype ?? prev.archetype,
        description: input.description ?? prev.description,
        pokemonJson: (input.pokemon ?? prev.pokemonJson) as unknown as string,
        trust: nextTrust,
        seenAt: nextSeenAt,
        updatedAt: now,
      })
      .where(eq(metaTeams.id, prev.id))
      .returning()
      .all();

    return rowToMetaTeam(updated[0]);
  }

  const inserted = await db
    .insert(metaTeams)
    .values({
      source: input.source,
      sourceRef: input.sourceRef ?? null,
      sourceUrl: input.sourceUrl ?? null,
      format,
      author: input.author ?? null,
      record: input.record ?? null,
      archetype: input.archetype ?? null,
      description: input.description ?? null,
      speciesFingerprint: fingerprint,
      speciesJson: input.species as unknown as string,
      pokemonJson: (input.pokemon ?? []) as unknown as string,
      trust: input.trust ?? 0.5,
      seenAt: input.seenAt ?? null,
    })
    .returning()
    .all();

  return rowToMetaTeam(inserted[0]);
}

export interface MatchOptions {
  species: string[];
  format?: string;
  minOverlap?: number;
  limit?: number;
}

export async function matchMetaTeams(
  opts: MatchOptions,
): Promise<MetaTeamMatch[]> {
  if (opts.species.length === 0) return [];
  const format = opts.format ?? "champions-reg-m-a";
  const minOverlap = opts.minOverlap ?? 2;
  const limit = opts.limit ?? 10;

  const normalizedQuery = opts.species.map(normalizeSpeciesForFingerprint);
  const querySet = new Set(normalizedQuery.filter(Boolean));

  const all = await db
    .select()
    .from(metaTeams)
    .where(eq(metaTeams.format, format))
    .all();

  const now = Date.now();
  const matches: MetaTeamMatch[] = [];
  for (const row of all) {
    const candidate = rowToMetaTeam(row);
    const overlap = countOverlap(normalizedQuery, candidate.species);
    if (overlap < minOverlap) continue;

    const trust = candidate.trust;
    const age =
      candidate.seenAt != null ? (now - candidate.seenAt) / 86400000 : 365;
    const recency = age < 30 ? 1.0 : Math.max(0.5, 1.0 - (age - 30) / 335);

    const overlapWeight = overlap / Math.max(candidate.species.length, 6);
    const score = overlapWeight * 0.6 + trust * 0.3 + recency * 0.1;

    const missing = candidate.species.filter(
      (s) => !querySet.has(normalizeSpeciesForFingerprint(s)),
    );

    matches.push({ team: candidate, overlap, score, missing });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

export async function listMetaTeams(
  format: string = "champions-reg-m-a",
  limit = 50,
): Promise<MetaTeam[]> {
  const rows = await db
    .select()
    .from(metaTeams)
    .where(eq(metaTeams.format, format))
    .orderBy(sql`coalesce(${metaTeams.seenAt}, ${metaTeams.createdAt}) desc`)
    .limit(limit)
    .all();
  return rows.map(rowToMetaTeam);
}

export async function countMetaTeams(
  format: string = "champions-reg-m-a",
): Promise<{ total: number; bySource: Record<string, number> }> {
  const rows = await db
    .select({
      source: metaTeams.source,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(metaTeams)
    .where(eq(metaTeams.format, format))
    .groupBy(metaTeams.source)
    .all();

  const bySource: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    bySource[r.source] = Number(r.count);
    total += Number(r.count);
  }
  return { total, bySource };
}

type MetaTeamRow = typeof metaTeams.$inferSelect;

function rowToMetaTeam(row: MetaTeamRow): MetaTeam {
  return {
    id: row.id,
    source: row.source as MetaTeamSource,
    sourceRef: row.sourceRef,
    sourceUrl: row.sourceUrl,
    format: row.format ?? "champions-reg-m-a",
    author: row.author,
    record: row.record,
    archetype: row.archetype,
    description: row.description,
    speciesFingerprint: row.speciesFingerprint,
    species: parseJsonArray<string>(row.speciesJson),
    pokemon: parseJsonArray(row.pokemonJson),
    trust: row.trust ?? 0.5,
    seenAt: row.seenAt,
    createdAt: row.createdAt ?? 0,
    updatedAt: row.updatedAt ?? 0,
  };
}

function parseJsonArray<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
