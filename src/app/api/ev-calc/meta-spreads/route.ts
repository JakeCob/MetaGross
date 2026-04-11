import { getMetaSpreads } from "@/lib/ev/meta-lookup";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const species = searchParams.get("species");
    const format = searchParams.get("format") ?? "champions-reg-m-a";

    if (!species) {
      return Response.json(
        { error: "species query parameter is required" },
        { status: 400 },
      );
    }

    const spreads = getMetaSpreads(species, format);

    return Response.json({ spreads });
  } catch (error) {
    console.error("Meta spreads lookup error:", error);
    return Response.json(
      { error: "Failed to lookup meta spreads" },
      { status: 500 },
    );
  }
}
