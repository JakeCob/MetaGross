import { importTeamFromPaste } from '@/lib/pokemon/sets';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const paste = body.paste;

    if (typeof paste !== 'string' || !paste.trim()) {
      return Response.json(
        { error: 'Missing or empty "paste" field' },
        { status: 400 },
      );
    }

    const pokemon = importTeamFromPaste(paste);
    return Response.json(pokemon);
  } catch (error) {
    console.error('POST /api/pokemon/parse-paste error:', error);
    return Response.json(
      { error: 'Failed to parse paste' },
      { status: 500 },
    );
  }
}
