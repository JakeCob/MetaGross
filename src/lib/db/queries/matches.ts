import { eq, desc, inArray } from 'drizzle-orm';
import { db } from '../index';
import { matches, matchTurns, matchTurnActions } from '../schema';
import type { Turn } from '@/lib/types/battle';
import { classifyArchetypeFromSnapshot } from '@/lib/team-analysis/team-context';

/** "Unknown" → null so we never persist a non-archetype as if it were one. */
function archetypeOrNull(arche: string): string | null {
  return arche && arche !== 'Unknown' ? arche : null;
}

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

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
  opponentScoutingJson: unknown;
  winConditionsJson: unknown;
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
export async function getAllMatches(
  userId: string = DEFAULT_USER_ID,
): Promise<MatchListItem[]> {
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
export async function getMatchById(
  id: string,
): Promise<MatchWithTurns | null> {
  const match = await db
    .select()
    .from(matches)
    .where(eq(matches.id, id))
    .get();

  if (!match) return null;

  const turnRows = await db
    .select()
    .from(matchTurns)
    .where(eq(matchTurns.matchId, id))
    .orderBy(matchTurns.turnNumber)
    .all();

  if (turnRows.length === 0) return { ...match, turns: [] };

  const turnIds = turnRows.map((t) => t.id);
  const allActions = await db
    .select()
    .from(matchTurnActions)
    .where(inArray(matchTurnActions.turnId, turnIds))
    .all();

  const actionsByTurn = new Map<string, MatchTurnActionRow[]>();
  for (const action of allActions) {
    const tid = action.turnId ?? '';
    if (!actionsByTurn.has(tid)) actionsByTurn.set(tid, []);
    actionsByTurn.get(tid)!.push(action);
  }

  const turns: MatchTurnWithActions[] = turnRows.map((turn) => ({
    ...turn,
    actions: actionsByTurn.get(turn.id) ?? [],
  }));

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
  opponentScoutingJson?: unknown;
  winConditionsJson?: unknown;
  /** Overrides the auto-classified archetypes (else derived from team snapshots). */
  archetypeSelf?: string | null;
  archetypeOpponent?: string | null;
}

export async function createMatch(data: CreateMatchInput): Promise<MatchRow> {
  const userId = data.userId ?? DEFAULT_USER_ID;
  const now = Date.now();

  // Auto-classify both archetypes from the team snapshots so opponent-matchup
  // analytics work without manual tagging (opponent prefers the full snapshot,
  // self the brought list since teamId already classifies the saved team).
  const archetypeSelf =
    data.archetypeSelf ??
    archetypeOrNull(
      classifyArchetypeFromSnapshot(data.myTeam, data.myBrought, data.format),
    );
  const archetypeOpponent =
    data.archetypeOpponent ??
    archetypeOrNull(
      classifyArchetypeFromSnapshot(
        data.opponentTeam,
        data.opponentBrought,
        data.format,
      ),
    );

  return db.transaction(async (tx) => {
    const match = await tx
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
        opponentScoutingJson:
          (data.opponentScoutingJson ?? null) as unknown as string,
        winConditionsJson:
          (data.winConditionsJson ?? []) as unknown as string,
        opponentName: data.opponentName ?? null,
        archetypeSelf,
        archetypeOpponent,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    if (data.turns && data.turns.length > 0) {
      for (const turn of data.turns) {
        const turnRow = await tx
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
          await tx
            .insert(matchTurnActions)
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
  opponentScoutingJson?: unknown;
  winConditionsJson?: unknown;
}

export async function updateMatch(
  id: string,
  data: UpdateMatchInput,
): Promise<MatchRow | null> {
  const existing = await db
    .select()
    .from(matches)
    .where(eq(matches.id, id))
    .get();
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
  if (data.opponentScoutingJson !== undefined)
    updateFields.opponentScoutingJson = data.opponentScoutingJson;
  if (data.winConditionsJson !== undefined)
    updateFields.winConditionsJson = data.winConditionsJson;

  // Re-derive the opponent archetype when their team/brought changes but no
  // explicit archetype was supplied (keeps matchup analytics current).
  const format =
    (data.format ?? (existing.format as string | null)) ?? "";
  if (
    data.archetypeOpponent === undefined &&
    (data.opponentTeam !== undefined || data.opponentBrought !== undefined)
  ) {
    updateFields.archetypeOpponent = archetypeOrNull(
      classifyArchetypeFromSnapshot(
        data.opponentTeam ?? existing.opponentTeam,
        data.opponentBrought ?? existing.opponentBrought,
        format,
      ),
    );
  }
  if (
    data.archetypeSelf === undefined &&
    (data.myTeam !== undefined || data.myBrought !== undefined)
  ) {
    updateFields.archetypeSelf = archetypeOrNull(
      classifyArchetypeFromSnapshot(
        data.myTeam ?? existing.myTeam,
        data.myBrought ?? existing.myBrought,
        format,
      ),
    );
  }

  await db.update(matches).set(updateFields).where(eq(matches.id, id)).run();

  return (await db.select().from(matches).where(eq(matches.id, id)).get()) ?? null;
}

// ---------------------------------------------------------------------------
// deleteMatch
// ---------------------------------------------------------------------------
export async function deleteMatch(id: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(matches)
    .where(eq(matches.id, id))
    .get();
  if (!existing) return false;

  await db.transaction(async (tx) => {
    const turnRows = await tx
      .select({ id: matchTurns.id })
      .from(matchTurns)
      .where(eq(matchTurns.matchId, id))
      .all();

    if (turnRows.length > 0) {
      const turnIds = turnRows.map((t) => t.id);
      await tx
        .delete(matchTurnActions)
        .where(inArray(matchTurnActions.turnId, turnIds))
        .run();
    }

    await tx.delete(matchTurns).where(eq(matchTurns.matchId, id)).run();
    await tx.delete(matches).where(eq(matches.id, id)).run();
  });

  return true;
}
