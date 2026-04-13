import { searchSpecies, getSpecies } from "@/lib/pokemon/species";
import type { SpeciesData } from "@/lib/pokemon/species";
import { matchArchetype } from "@/lib/data/archetype-keywords";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "20", 10) || 20,
      50,
    );

    if (!q.trim()) {
      return Response.json([]);
    }

    // 1) Name-based species search (handles "meta", "garchom", etc.)
    const nameResults = searchSpecies(q, limit);

    // 2) Archetype/keyword match (handles "rain", "bulky", "tailwind", etc.)
    const archetype = matchArchetype(q);
    const seen = new Set(nameResults.map((r) => r.name.toLowerCase()));

    const archetypeSpecies: SpeciesData[] = [];
    for (const species of archetype.pokemon) {
      if (seen.has(species.toLowerCase())) continue;
      const data = getSpecies(species);
      if (data) {
        archetypeSpecies.push(data);
        seen.add(species.toLowerCase());
      }
      if (nameResults.length + archetypeSpecies.length >= limit) break;
    }

    const combined = [...nameResults, ...archetypeSpecies].slice(0, limit);
    return Response.json(combined);
  } catch (error) {
    console.error("GET /api/pokemon/search error:", error);
    return Response.json(
      { error: "Failed to search species" },
      { status: 500 },
    );
  }
}
