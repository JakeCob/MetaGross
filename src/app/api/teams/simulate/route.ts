import { simulateVsProvenTeams } from "@/lib/engine/tournament-sim";
import { db } from "@/lib/db";
import { analysisCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { ACTIVE_REGULATION_FORMAT_ID, getRegulation } from "@/lib/data/champions";

export const runtime = "nodejs";
export const maxDuration = 120;

const ZERO_EVS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const FLAT_IVS = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

/** Fill any missing fields so the calc engine gets a complete TeamPokemon. */
function coerce(p: Partial<TeamPokemon>): TeamPokemon {
  const moves = (p.moves ?? []).filter(Boolean);
  return {
    species: p.species as string,
    ability: p.ability ?? "",
    item: p.item ?? "",
    nature: p.nature ?? "Hardy",
    level: p.level ?? 50,
    teraType: p.teraType,
    megaEvolution: p.megaEvolution,
    moves: [moves[0] ?? "", moves[1] ?? "", moves[2] ?? "", moves[3] ?? ""],
    evs: p.evs ?? { ...ZERO_EVS },
    ivs: p.ivs ?? { ...FLAT_IVS },
  };
}

function teamKey(team: TeamPokemon[]): string {
  return team
    .map((p) => `${p.species}@${p.item}:${(p.moves ?? []).filter(Boolean).join("/")}`)
    .sort()
    .join("|");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { team, format, limit } = body as {
      team: Partial<TeamPokemon>[];
      format?: string;
      limit?: number;
    };

    const filled = (Array.isArray(team) ? team : []).filter((p) => p?.species?.trim());
    if (filled.length < 1) {
      return Response.json({ error: "Provide a team with at least 1 Pokémon." }, { status: 400 });
    }

    const formatId = getRegulation(format ?? ACTIVE_REGULATION_FORMAT_ID).formatId;
    const userTeam = filled.map(coerce);
    const max = typeof limit === "number" && limit > 0 ? Math.min(limit, 12) : 8;

    const cacheKey = `tournament-sim:${formatId}:${max}:${teamKey(userTeam)}`;
    const cached = await db
      .select()
      .from(analysisCache)
      .where(eq(analysisCache.cacheKey, cacheKey))
      .get();
    if (cached && cached.expiresAt && cached.expiresAt > Date.now()) {
      return Response.json({ ...(cached.resultJson as object), cached: true });
    }

    const result = await simulateVsProvenTeams(userTeam, formatId, max);
    const expiresAt = Date.now() + 6 * 60 * 60 * 1000;
    if (cached) {
      await db
        .update(analysisCache)
        .set({ resultJson: result as unknown as Record<string, unknown>, expiresAt, createdAt: Date.now() })
        .where(eq(analysisCache.cacheKey, cacheKey))
        .run();
    } else {
      await db
        .insert(analysisCache)
        .values({
          cacheKey,
          cacheType: "tournament-sim",
          resultJson: result as unknown as Record<string, unknown>,
          model: "engine",
          expiresAt,
        })
        .run();
    }

    return Response.json({ ...result, cached: false });
  } catch (error) {
    console.error("POST /api/teams/simulate error:", error);
    return Response.json(
      { error: "Failed to run simulation", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
