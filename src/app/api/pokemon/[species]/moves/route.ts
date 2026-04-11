import { getMovesForSpecies, getMove } from '@/lib/pokemon/moves';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ species: string }> },
) {
  try {
    const { species: speciesName } = await params;
    const { searchParams } = new URL(request.url);
    const detail = searchParams.get('detail') === 'true';

    const moveNames = await getMovesForSpecies(decodeURIComponent(speciesName));

    if (!detail) {
      return Response.json(moveNames);
    }

    // Return full move data when detail=true
    const moveData: Record<string, ReturnType<typeof getMove>> = {};
    for (const name of moveNames) {
      const data = getMove(name);
      if (data) moveData[name] = data;
    }

    return Response.json({ names: moveNames, data: moveData });
  } catch (error) {
    console.error('GET /api/pokemon/[species]/moves error:', error);
    return Response.json(
      { error: 'Failed to fetch moves' },
      { status: 500 },
    );
  }
}
