import { calculateBenchmarks } from "@/lib/ev/benchmark";
import { getMetaThreats } from "@/lib/ev/meta-lookup";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      pokemon,
      format = ACTIVE_REGULATION_FORMAT_ID,
    } = body as {
      pokemon: TeamPokemon;
      format?: string;
    };

    if (!pokemon || !pokemon.species) {
      return Response.json(
        { error: "pokemon with species is required" },
        { status: 400 },
      );
    }

    const threats = getMetaThreats(format);
    const report = calculateBenchmarks(pokemon, threats);

    return Response.json({ report });
  } catch (error) {
    console.error("Benchmark calculation error:", error);
    return Response.json(
      { error: "Failed to calculate benchmarks" },
      { status: 500 },
    );
  }
}
