import { getAbilitiesForSpecies } from '@/lib/pokemon/abilities';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const species = searchParams.get('species') ?? '';

    if (!species.trim()) {
      return Response.json([]);
    }

    const abilities = getAbilitiesForSpecies(species);
    return Response.json(abilities);
  } catch (error) {
    console.error('GET /api/pokemon/abilities error:', error);
    return Response.json(
      { error: 'Failed to fetch abilities' },
      { status: 500 },
    );
  }
}
