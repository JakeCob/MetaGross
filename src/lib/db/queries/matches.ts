import { eq, desc } from 'drizzle-orm';
import { db } from '../index';
import { matches, matchTurns, matchTurnActions } from '../schema';
import type { Turn } from '@/lib/types/battle';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// Row shapes returned to the API layer
// ---------------------------------------------------------------------------
export interface MatchRow {
  id: string;
  userId: string | null;
  teamId: string | null;
  format: string | null;
  mode: string | null;
  result: string | null;
  playedAt: number | null;
  notes: string | null;
  myTeam: unknown;
  opponentTeam: unknown;
  myBrought: unknown;
  opponentBrought: unknown;
  myLeads: unknown;
  opponentLeads: unknown;
  ruleAnalysisJson: unknown;
  aiAnalysisJson: unknown;
  analyzedAt: number | null;
  opponentName: string | null;
  archetypeSelf: string | null;
  archetypeOpponent: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface MatchTurnActionRow {
  id: string;
  turnId: string | null;
  side: string | null;
  slot: number | null;
  actionType: string | null;
  moveName: string | null;
  targetSide: string | null;
  targetSlot: number | null;
  damageDealtPercent: number | null;
  wasCriticalHit: number | null;
  wasKo: number | null;
  switchInSpecies: string | null;
  switchOutSpecies: string | null;
  megaEvolved: number | null;
  moveGrade: string | null;
  gradeReason: string | null;
  optimalPlay: string | null;
  createdAt: number | null;
}

export interface MatchTurnRow {
  id: string;
  matchId: string | null;
  turnNumber: number | null;
  fieldState: unknown;
  activeP1: unknown;
  activeP2: unknown;
  winProbability: number | null;
  isTurningPoint: number | null;
  createdAt: number | null;
}

export interface MatchTurnWithActions extends MatchTurnRow {
  actions: MatchTurnActionRow[];
}

export interface MatchListItem {
  id: string;
  format: string | null;
  mode: string | null;
  result: string | null;
  playedAt: number | null;
  opponentName: string | null;
  myBrought: unknown;
  myLeads: unknown;
  opponentLeads: unknown;
  archetypeSelf: string | null;
  archetypeOpponent: string | null;
}

export interface MatchWithTurns extends MatchRow {
  turns: MatchTurnWithActions[];
}

// ---------------------------------------------------------------------------
// getAllMatches
// ---------------------------------------------------------------------------
export function getAllMatches(userId: string = DEFAULT_USER_ID): MatchListItem[] {
  return db
    .select({
      id: matches.id,
      format: matches.format,
      mode: matches.mode,
      result: matches.result,
      playedAt: matches.playedAt,
      opponentName: matches.opponentName,
      myBrought: matches.myBrought,
      myLeads: matches.myLeads,
      opponentLeads: matches.opponentLeads,
      archetypeSelf: matches.archetypeSelf,
      archetypeOpponent: matches.archetypeOpponent,
    })
    .from(matches)
    .where(eq(matches.userId, userId))
    .orderBy(desc(matches.playedAt))
    .all();
}

// ---------------------------------------------------------------------------
// getMatchById
// ---------------------------------------------------------------------------
export function getMatchById(id: string): MatchWithTurns | null {
  const match = db
    .select()
    .from(matches)
    .where(eq(matches.id, id))
    .get();

  if (!match) return null;

  const turnRows = db
    .select()
    .from(matchTurns)
    .where(eq(matchTurns.matchId, id))
    .orderBy(matchTurns.turnNumber)
    .all();

  const turns: MatchTurnWithActions[] = turnRows.map((turn) => {
    const actions = db
      .select()
      .from(matchTurnActions)
      .where(eq(matchTurnActions.turnId, turn.id))
      .all();

    return { ...turn, actions };
  });

  return { ...match, turns };
}

// ---------------------------------------------------------------------------
// createMatch
// ---------------------------------------------------------------------------
export interface CreateMatchInput {
  format: string;
  mode: string;
  result: string;
  myTeam: unknown;
  opponentTeam: unknown;
  myBrought?: unknown;
  opponentBrought?: unknown;
  myLeads?: unknown;
  opponentLeads?: unknown;
  opponentName?: string;
  notes?: string;
  teamId?: string | null;
  userId?: string;
  turns?: Turn[];
}

export function createMatch(data: CreateMatchInput): MatchRow {
  const userId = data.userId ?? DEFAULT_USER_ID;
  const now = Date.now();

  return db.transaction((tx) => {
    // Insert the match
    const match = tx
      .insert(matches)
      .values({
        userId,
        teamId: data.teamId ?? null,
        format: data.format,
        mode: data.mode,
        result: data.result,
        playedAt: now,
        notes: data.notes ?? null,
        myTeam: data.myTeam as string,
        opponentTeam: data.opponentTeam as string,
        myBrought: (data.myBrought ?? []) as string,
        opponentBrought: (data.opponentBrought ?? []) as string,
        myLeads: (data.myLeads ?? []) as string,
        opponentLeads: (data.opponentLeads ?? []) as string,
        opponentName: data.opponentName ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    // Insert turns and their actions if provided
    if (data.turns && data.turns.length > 0) {
      for (const turn of data.turns) {
        const turnRow = tx
          .insert(matchTurns)
          .values({
            matchId: match.id,
            turnNumber: turn.number,
            fieldState: turn.fieldState as unknown as string,
            activeP1: turn.activeP1 as unknown as string,
            activeP2: turn.activeP2 as unknown as string,
            winProbability: turn.winProbability ?? null,
            isTurningPoint: turn.isTurningPoint ? 1 : 0,
            createdAt: now,
          })
          .returning()
          .get();

        for (const action of turn.actions) {
          tx.insert(matchTurnActions)
            .values({
              turnId: turnRow.id,
              side: action.side,
              slot: action.slot,
              actionType: action.actionType,
              moveName: action.moveName ?? null,
              targetSide: action.targetSide ?? null,
              targetSlot: action.targetSlot ?? null,
              damageDealtPercent: action.damageDealtPercent ?? null,
              wasCriticalHit: action.wasCriticalHit ? 1 : 0,
              wasKo: action.wasKo ? 1 : 0,
              switchInSpecies: action.switchInSpecies ?? null,
              switchOutSpecies: action.switchOutSpecies ?? null,
              megaEvolved: action.megaEvolved ? 1 : 0,
              createdAt: now,
            })
            .run();
        }
      }
    }

    return match;
  });
}

// ---------------------------------------------------------------------------
// updateMatch
// ---------------------------------------------------------------------------
export interface UpdateMatchInput {
  format?: string;
  mode?: string;
  result?: string;
  myTeam?: unknown;
  opponentTeam?: unknown;
  myBrought?: unknown;
  opponentBrought?: unknown;
  myLeads?: unknown;
  opponentLeads?: unknown;
  opponentName?: string | null;
  notes?: string | null;
  teamId?: string | null;
  archetypeSelf?: string | null;
  archetypeOpponent?: string | null;
  ruleAnalysisJson?: unknown;
  aiAnalysisJson?: unknown;
  analyzedAt?: number | null;
}

export function updateMatch(id: string, data: UpdateMatchInput): MatchRow | null {
  const existing = db.select().from(matches).where(eq(matches.id, id)).get();
  if (!existing) return null;

  const now = Date.now();

  const updateFields: Record<string, unknown> = { updatedAt: now };
  if (data.format !== undefined) updateFields.format = data.format;
  if (data.mode !== undefined) updateFields.mode = data.mode;
  if (data.result !== undefined) updateFields.result = data.result;
  if (data.myTeam !== undefined) updateFields.myTeam = data.myTeam;
  if (data.opponentTeam !== undefined) updateFields.opponentTeam = data.opponentTeam;
  if (data.myBrought !== undefined) updateFields.myBrought = data.myBrought;
  if (data.opponentBrought !== undefined) updateFields.opponentBrought = data.opponentBrought;
  if (data.myLeads !== undefined) updateFields.myLeads = data.myLeads;
  if (data.opponentLeads !== undefined) updateFields.opponentLeads = data.opponentLeads;
  if (data.opponentName !== undefined) updateFields.opponentName = data.opponentName;
  if (data.notes !== undefined) updateFields.notes = data.notes;
  if (data.teamId !== undefined) updateFields.teamId = data.teamId;
  if (data.archetypeSelf !== undefined) updateFields.archetypeSelf = data.archetypeSelf;
  if (data.archetypeOpponent !== undefined) updateFields.archetypeOpponent = data.archetypeOpponent;
  if (data.ruleAnalysisJson !== undefined) updateFields.ruleAnalysisJson = data.ruleAnalysisJson;
  if (data.aiAnalysisJson !== undefined) updateFields.aiAnalysisJson = data.aiAnalysisJson;
  if (data.analyzedAt !== undefined) updateFields.analyzedAt = data.analyzedAt;

  db.update(matches).set(updateFields).where(eq(matches.id, id)).run();

  return db.select().from(matches).where(eq(matches.id, id)).get()!;
}

// ---------------------------------------------------------------------------
// deleteMatch
// ---------------------------------------------------------------------------
export function deleteMatch(id: string): boolean {
  const existing = db.select().from(matches).where(eq(matches.id, id)).get();
  if (!existing) return false;

  db.transaction((tx) => {
    // Get all turn IDs for this match
    const turnRows = tx
      .select({ id: matchTurns.id })
      .from(matchTurns)
      .where(eq(matchTurns.matchId, id))
      .all();

    // Delete actions for each turn
    for (const turn of turnRows) {
      tx.delete(matchTurnActions).where(eq(matchTurnActions.turnId, turn.id)).run();
    }

    // Delete turns
    tx.delete(matchTurns).where(eq(matchTurns.matchId, id)).run();

    // Delete the match itself
    tx.delete(matches).where(eq(matches.id, id)).run();
  });

  return true;
}
