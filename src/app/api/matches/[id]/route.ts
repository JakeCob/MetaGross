import {
  getMatchById,
  updateMatch,
  deleteMatch,
} from '@/lib/db/queries/matches';
import { z } from 'zod';

const matchUpdateSchema = z.object({
  format: z.string().min(1).optional(),
  mode: z.string().min(1).optional(),
  result: z.enum(['win', 'loss']).optional(),
  myTeam: z.unknown().optional(),
  opponentTeam: z.unknown().optional(),
  myBrought: z.unknown().optional(),
  opponentBrought: z.unknown().optional(),
  myLeads: z.unknown().optional(),
  opponentLeads: z.unknown().optional(),
  opponentName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  archetypeSelf: z.string().nullable().optional(),
  archetypeOpponent: z.string().nullable().optional(),
  ruleAnalysisJson: z.unknown().optional(),
  aiAnalysisJson: z.unknown().optional(),
  analyzedAt: z.number().nullable().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const match = await getMatchById(id);

    if (!match) {
      return Response.json({ error: 'Match not found' }, { status: 404 });
    }

    return Response.json({ match });
  } catch (error) {
    console.error('GET /api/matches/[id] error:', error);
    return Response.json(
      { error: 'Failed to fetch match' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const parsed = matchUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => i.message);
      return Response.json(
        { error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const updated = await updateMatch(id, {
      format: data.format,
      mode: data.mode,
      result: data.result,
      myTeam: data.myTeam,
      opponentTeam: data.opponentTeam,
      myBrought: data.myBrought,
      opponentBrought: data.opponentBrought,
      myLeads: data.myLeads,
      opponentLeads: data.opponentLeads,
      opponentName: data.opponentName,
      notes: data.notes,
      teamId: data.teamId,
      archetypeSelf: data.archetypeSelf,
      archetypeOpponent: data.archetypeOpponent,
      ruleAnalysisJson: data.ruleAnalysisJson,
      aiAnalysisJson: data.aiAnalysisJson,
      analyzedAt: data.analyzedAt,
    });

    if (!updated) {
      return Response.json({ error: 'Match not found' }, { status: 404 });
    }

    return Response.json({ match: updated });
  } catch (error) {
    console.error('PUT /api/matches/[id] error:', error);
    return Response.json(
      { error: 'Failed to update match' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteMatch(id);

    if (!deleted) {
      return Response.json({ error: 'Match not found' }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('DELETE /api/matches/[id] error:', error);
    return Response.json(
      { error: 'Failed to delete match' },
      { status: 500 },
    );
  }
}
