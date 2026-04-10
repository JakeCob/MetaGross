import {
  getMatchById,
  updateMatch,
  deleteMatch,
} from '@/lib/db/queries/matches';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const match = getMatchById(id);

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

    const updated = updateMatch(id, {
      format: body.format,
      mode: body.mode,
      result: body.result,
      myTeam: body.myTeam,
      opponentTeam: body.opponentTeam,
      myBrought: body.myBrought,
      opponentBrought: body.opponentBrought,
      myLeads: body.myLeads,
      opponentLeads: body.opponentLeads,
      opponentName: body.opponentName,
      notes: body.notes,
      teamId: body.teamId,
      archetypeSelf: body.archetypeSelf,
      archetypeOpponent: body.archetypeOpponent,
      ruleAnalysisJson: body.ruleAnalysisJson,
      aiAnalysisJson: body.aiAnalysisJson,
      analyzedAt: body.analyzedAt,
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
    const deleted = deleteMatch(id);

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
