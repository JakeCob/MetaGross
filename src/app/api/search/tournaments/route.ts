import { searchTournamentResults } from "@/lib/search/meta-enricher";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? ACTIVE_REGULATION_FORMAT_ID;

    const results = await searchTournamentResults(format);

    return Response.json({ results });
  } catch (error) {
    console.error("Tournament search error:", error);
    const message =
      error instanceof Error ? error.message : "Search failed";
    const status = message.includes("limit reached") ? 429 : 500;
    return Response.json({ error: message }, { status });
  }
}
