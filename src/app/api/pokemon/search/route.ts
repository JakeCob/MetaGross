import { searchSpecies, getSpecies } from "@/lib/pokemon/species";
import type { SpeciesData } from "@/lib/pokemon/species";
import { matchArchetype } from "@/lib/data/archetype-keywords";
import { CHAMPIONS_POKEMON } from "@/lib/data/champions";

function searchChampionsSpecies(query: string, limit: number): SpeciesData[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const results: SpeciesData[] = [];
  const seen = new Set<string>();

  for (const name of CHAMPIONS_POKEMON) {
    if (results.length >= limit) break;

    const data = getSpecies(name);
    if (!data) continue;

    const matches =
      name.toLowerCase().startsWith(lowerQuery) ||
      data.name.toLowerCase().startsWith(lowerQuery);
    if (!matches) continue;

    if (seen.has(data.name.toLowerCase())) continue;
    seen.add(data.name.toLowerCase());
    results.push(data);
  }

  return results;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const format = searchParams.get("format") ?? "";
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "20", 10) || 20,
      50,
    );
    const isChampionsFormat = format.toLowerCase().startsWith("champions");
    const championsSet = new Set(CHAMPIONS_POKEMON.map((name) => name.toLowerCase()));

    if (!q.trim()) {
      return Response.json([]);
    }

    // 1) Name-based species search (handles "meta", "garchom", etc.)
    const nameResults = isChampionsFormat
      ? searchChampionsSpecies(q, limit)
      : searchSpecies(q, limit);

    // 2) Archetype/keyword match (handles "rain", "bulky", "tailwind", etc.)
    const archetype = matchArchetype(q);
    const seen = new Set(nameResults.map((r) => r.name.toLowerCase()));

    const archetypeSpecies: SpeciesData[] = [];
    for (const species of archetype.pokemon) {
      if (isChampionsFormat && !championsSet.has(species.toLowerCase())) {
        continue;
      }
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
