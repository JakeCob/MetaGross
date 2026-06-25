import { importTeamFromPaste } from '@/lib/pokemon/sets';
import { fetchPokepasteRaw } from '@/lib/meta-teams/scrapers/pokepaste';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let paste: unknown = body.paste;

    // Accept a pokepaste URL too — fetched server-side (the browser can't,
    // cross-origin), which is how the proven-teams browser pulls full sets for
    // a species-only team. fetchPokepasteRaw only accepts pokepast.es hosts, so
    // this can't be turned into an SSRF for arbitrary URLs.
    const url = body.url;
    if (typeof url === 'string' && url.trim()) {
      const raw = await fetchPokepasteRaw(url.trim(), 8000);
      if (!raw) {
        return Response.json(
          { error: 'Could not fetch that pokepaste URL' },
          { status: 502 },
        );
      }
      paste = raw;
    }

    if (typeof paste !== 'string' || !paste.trim()) {
      return Response.json(
        { error: 'Missing or empty "paste"/"url" field' },
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
