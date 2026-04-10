import { getAllMatches, createMatch } from '@/lib/db/queries/matches';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function GET() {
  try {
    const matches = getAllMatches(DEFAULT_USER_ID);
    return Response.json({ matches });
  } catch (error) {
    console.error('GET /api/matches error:', error);
    return Response.json(
      { error: 'Failed to fetch matches' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    const errors: string[] = [];
    if (!body.format) errors.push('format is required');
    if (!body.mode) errors.push('mode is required');
    if (!body.result) errors.push('result is required');
    if (!body.myTeam) errors.push('myTeam is required');
    if (!body.opponentTeam) errors.push('opponentTeam is required');

    if (errors.length > 0) {
      return Response.json(
        { error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    if (!['win', 'loss'].includes(body.result)) {
      return Response.json(
        { error: "result must be 'win' or 'loss'" },
        { status: 400 },
      );
    }

    if (!['realtime', 'postmatch', 'quick'].includes(body.mode)) {
      return Response.json(
        { error: "mode must be 'realtime', 'postmatch', or 'quick'" },
        { status: 400 },
      );
    }

    const match = createMatch({
      format: body.format,
      mode: body.mode,
      result: body.result,
      myTeam: body.myTeam,
      opponentTeam: body.opponentTeam,
      myBrought: body.myBrought ?? [],
      opponentBrought: body.opponentBrought ?? [],
      myLeads: body.myLeads ?? [],
      opponentLeads: body.opponentLeads ?? [],
      opponentName: body.opponentName,
      notes: body.notes,
      teamId: body.myTeamId ?? body.teamId ?? null,
      userId: DEFAULT_USER_ID,
      turns: Array.isArray(body.turns) ? body.turns : undefined,
    });

    return Response.json({ match }, { status: 201 });
  } catch (error) {
    console.error('POST /api/matches error:', error);
    return Response.json(
      { error: 'Failed to create match' },
      { status: 500 },
    );
  }
}
