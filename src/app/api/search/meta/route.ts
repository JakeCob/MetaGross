import { searchVGCMeta } from "@/lib/search";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const format = searchParams.get("format") ?? ACTIVE_REGULATION_FORMAT_ID;

    if (!query) {
      return Response.json(
        { error: "q query parameter is required" },
        { status: 400 },
      );
    }

    const fullQuery = `${query} VGC ${format}`;
    const results = await searchVGCMeta(fullQuery);

    return Response.json({ results });
  } catch (error) {
    console.error("Meta search error:", error);
    const message =
      error instanceof Error ? error.message : "Search failed";
    const status = message.includes("limit reached") ? 429 : 500;
    return Response.json({ error: message }, { status });
  }
}
