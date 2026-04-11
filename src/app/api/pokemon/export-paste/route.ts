import { exportTeamToPaste } from '@/lib/pokemon/sets';
import type { TeamPokemon } from '@/lib/types/pokemon';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const team = body.team;

    if (!Array.isArray(team) || team.length === 0) {
      return Response.json(
        { error: 'Missing or empty "team" array' },
        { status: 400 },
      );
    }

    const paste = exportTeamToPaste(team as TeamPokemon[]);
    return Response.json({ paste });
  } catch (error) {
    console.error('POST /api/pokemon/export-paste error:', error);
    return Response.json(
      { error: 'Failed to export paste' },
      { status: 500 },
    );
  }
}
