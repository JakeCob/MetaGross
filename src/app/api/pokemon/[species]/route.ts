import { getSpecies } from '@/lib/pokemon/species';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ species: string }> },
) {
  try {
    const { species: speciesName } = await params;
    const data = getSpecies(decodeURIComponent(speciesName));

    if (!data) {
      return Response.json({ error: 'Species not found' }, { status: 404 });
    }

    return Response.json(data);
  } catch (error) {
    console.error('GET /api/pokemon/[species] error:', error);
    return Response.json(
      { error: 'Failed to fetch species data' },
      { status: 500 },
    );
  }
}
