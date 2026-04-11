import { searchSpecies } from '@/lib/pokemon/species';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') ?? '';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 50);

    if (!q.trim()) {
      return Response.json([]);
    }

    const results = searchSpecies(q, limit);
    return Response.json(results);
  } catch (error) {
    console.error('GET /api/pokemon/search error:', error);
    return Response.json(
      { error: 'Failed to search species' },
      { status: 500 },
    );
  }
}
