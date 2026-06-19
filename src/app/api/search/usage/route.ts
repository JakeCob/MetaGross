import { searchPokemonUsage } from "@/lib/search/meta-enricher";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const species = searchParams.get("species");
    const format = searchParams.get("format") ?? ACTIVE_REGULATION_FORMAT_ID;

    if (!species) {
      return Response.json(
        { error: "species query parameter is required" },
        { status: 400 },
      );
    }

    const usageInfo = await searchPokemonUsage(species, format);

    return Response.json({ usage: usageInfo });
  } catch (error) {
    console.error("Usage search error:", error);
    const message =
      error instanceof Error ? error.message : "Search failed";
    const status = message.includes("limit reached") ? 429 : 500;
    return Response.json({ error: message }, { status });
  }
}
