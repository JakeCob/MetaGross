import { getAllTeams, createTeam } from '@/lib/db/queries/teams';
import { validateTeam } from '@/lib/validation/team';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function GET() {
  try {
    const teams = await getAllTeams(DEFAULT_USER_ID);
    return Response.json({ teams });
  } catch (error) {
    console.error('GET /api/teams error:', error);
    return Response.json(
      { error: 'Failed to fetch teams' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = validateTeam(body);
    if (!validation.success) {
      return Response.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 },
      );
    }

    const { name, format, pokemon } = validation.data;

    const team = await createTeam({
      name,
      format,
      userId: DEFAULT_USER_ID,
      pokepaste: body.pokepaste,
      description: body.description,
      notes: body.notes,
      pokemon,
    });

    return Response.json({ team }, { status: 201 });
  } catch (error) {
    console.error('POST /api/teams error:', error);
    return Response.json(
      { error: 'Failed to create team' },
      { status: 500 },
    );
  }
}
