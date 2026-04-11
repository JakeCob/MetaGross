import { getSmogonStats, getTopUsage, VGC_FORMATS } from "@/lib/pokemon/smogon";
import {
  getPikalyticsTopUsage,
  getPikalyticsPokemonDetail,
  PIKALYTICS_FORMATS,
  PIKALYTICS_FORMAT_IDS,
  DEFAULT_PIKALYTICS_FORMAT,
} from "@/lib/pokemon/pikalytics";
import {
  getAggregatedTopUsage,
  getAggregatedPokemonDetail,
} from "@/lib/pokemon/meta-aggregator";

/**
 * GET /api/pokemon/usage
 *
 * Query params:
 *   ?species=Incineroar&format=championspreview  -> detailed usage stats for one Pokemon
 *   ?format=championspreview&top=50              -> top N most-used Pokemon in format
 *   ?formats=true                                -> list available formats (Pikalytics + Smogon)
 *   ?source=pikalytics|smogon|limitless|aggregated -> force a specific data source
 *
 * Default: aggregated data from Pikalytics + Limitless + Smogon.
 * Use ?source=pikalytics or ?source=smogon to force a single source.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const species = searchParams.get("species");
    const format = searchParams.get("format") || DEFAULT_PIKALYTICS_FORMAT;
    const top = searchParams.get("top");
    const formats = searchParams.get("formats");
    const source = searchParams.get("source"); // "pikalytics" | "smogon" | "limitless" | "aggregated" | null

    const cacheHeaders = {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    };

    // Return available formats (both sources merged)
    if (formats === "true") {
      const allFormats = [
        ...PIKALYTICS_FORMATS.map((f) => ({
          id: f.id,
          label: f.label,
          source: "pikalytics" as const,
        })),
        ...VGC_FORMATS.map((f) => ({
          id: f.id,
          label: f.label,
          source: "smogon" as const,
        })),
      ];
      return Response.json({ formats: allFormats });
    }

    // ----- Detailed stats for a specific Pokemon -----
    if (species) {
      // Single source: Pikalytics
      if (source === "pikalytics") {
        const detail = await getPikalyticsPokemonDetail(species, format);
        if (!detail) {
          return Response.json(
            { error: `No Pikalytics data for ${species} in ${format}` },
            { status: 404 },
          );
        }
        return Response.json(
          { ...detail, source: "pikalytics", dataSources: ["pikalytics"] },
          { headers: cacheHeaders },
        );
      }

      // Single source: Smogon
      if (source === "smogon") {
        const stats = await getSmogonStats(species, format);
        if (!stats) {
          return Response.json(
            { error: `No Smogon data for ${species} in ${format}` },
            { status: 404 },
          );
        }
        return Response.json(
          { ...stats, source: "smogon", dataSources: ["smogon"] },
          { headers: cacheHeaders },
        );
      }

      // Default / aggregated: merge from all sources
      const aggregated = await getAggregatedPokemonDetail(species, format);
      if (!aggregated) {
        return Response.json(
          { error: `No usage data found for ${species} in ${format}` },
          { status: 404 },
        );
      }
      return Response.json(
        { ...aggregated, source: "aggregated" },
        { headers: cacheHeaders },
      );
    }

    // ----- Top N most-used Pokemon -----
    if (top) {
      const limit = Math.min(Math.max(parseInt(top, 10) || 50, 1), 100);

      // Single source: Pikalytics
      if (source === "pikalytics") {
        const entries = await getPikalyticsTopUsage(format);
        if (entries.length === 0) {
          return Response.json(
            { error: `No Pikalytics data for format ${format}` },
            { status: 404 },
          );
        }
        const sliced = entries.slice(0, limit);
        return Response.json(
          {
            format,
            source: "pikalytics",
            dataSources: ["pikalytics"],
            pokemon: sliced.map((e) => ({
              species: e.species,
              usage: e.usagePercent,
              rank: e.rank,
              webUrl: e.webUrl,
              aiUrl: e.aiUrl,
            })),
          },
          { headers: cacheHeaders },
        );
      }

      // Single source: Smogon
      if (source === "smogon") {
        const usage = await getTopUsage(format, limit);
        if (usage.length === 0) {
          return Response.json(
            { error: `No Smogon data for format ${format}` },
            { status: 404 },
          );
        }
        return Response.json(
          {
            format,
            source: "smogon",
            dataSources: ["smogon"],
            pokemon: usage,
          },
          { headers: cacheHeaders },
        );
      }

      // Default / aggregated: merge from all sources
      const aggregated = await getAggregatedTopUsage(format);
      if (aggregated.length === 0) {
        return Response.json(
          { error: `No usage data found for format ${format}` },
          { status: 404 },
        );
      }

      // Collect which sources contributed
      const dataSources = new Set<string>();
      for (const entry of aggregated) {
        if (entry.sources.pikalytics) dataSources.add("pikalytics");
        if (entry.sources.limitless) dataSources.add("limitless");
        if (entry.sources.smogon) dataSources.add("smogon");
      }

      const sliced = aggregated.slice(0, limit);
      return Response.json(
        {
          format,
          source: "aggregated",
          dataSources: Array.from(dataSources),
          pokemon: sliced.map((e) => ({
            species: e.species,
            usage: e.combinedUsage,
            rank: e.rank,
            sources: e.sources,
          })),
        },
        { headers: cacheHeaders },
      );
    }

    return Response.json(
      {
        error:
          "Provide ?species=NAME or ?top=N (optionally with &format=FORMAT)",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("GET /api/pokemon/usage error:", error);
    return Response.json(
      { error: "Failed to fetch usage data" },
      { status: 500 },
    );
  }
}
