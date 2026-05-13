import { z } from "zod";
import {
  getReferenceSetsForSpecies,
  type ReferenceSet,
} from "@/lib/meta-teams/species-sets";

export const runtime = "nodejs";

const BodySchema = z.object({
  species: z.array(z.string().min(1)).min(1).max(12),
  format: z.string().optional(),
});

export interface CanonicalSet {
  ability: string;
  item: string;
  nature: string;
  moves: string[];
  teraType: string | null;
  evs: {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
  } | null;
  source: ReferenceSet["source"];
  author: string | null;
  trust: number;
}

/**
 * Parse a Showdown-style "252 HP / 0 Atk / 252 Def / 4 SpD" string into
 * a normalised stat object. Returns null when nothing parses — keeps
 * client defaults intact for un-specified spreads.
 */
function parseEvs(raw: string | undefined): CanonicalSet["evs"] {
  if (!raw) return null;
  const re = /(\d+)\s*(HP|Atk|Def|SpA|SpD|Spe)\b/gi;
  let matched = false;
  const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    matched = true;
    const value = Math.min(252, Math.max(0, parseInt(m[1], 10) || 0));
    const key = m[2].toLowerCase();
    switch (key) {
      case "hp":
        evs.hp = value;
        break;
      case "atk":
        evs.atk = value;
        break;
      case "def":
        evs.def = value;
        break;
      case "spa":
        evs.spa = value;
        break;
      case "spd":
        evs.spd = value;
        break;
      case "spe":
        evs.spe = value;
        break;
    }
  }
  return matched ? evs : null;
}

/**
 * POST /api/pokemon/canonical-set
 *
 * Returns the highest-trust verified tournament/creator set per species
 * from our meta_teams pool. Used by the team-builder when the agent's
 * research card lists species names without full set details — without
 * this fallback the resulting build is empty Ability/Moves/etc and the
 * team can't be saved (server validation rejects).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid body", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { species, format } = parsed.data;
    const result: Record<string, CanonicalSet | null> = {};

    // Run lookups in parallel — each one hits the same meta_teams pool
    // but listMetaTeams caches internally and the queries are cheap.
    await Promise.all(
      species.map(async (sp) => {
        try {
          const sets = await getReferenceSetsForSpecies(
            sp,
            format ?? "champions-reg-m-a",
            1,
          );
          const top = sets[0];
          if (!top) {
            result[sp] = null;
            return;
          }
          result[sp] = {
            ability: top.ability ?? "",
            item: top.item ?? "",
            nature: top.nature ?? "Hardy",
            moves: top.moves.filter((m) => m && m.trim().length > 0),
            teraType: top.teraType ?? null,
            evs: parseEvs(top.evs),
            source: top.source,
            author: top.author,
            trust: top.trust,
          };
        } catch {
          result[sp] = null;
        }
      }),
    );

    return Response.json({ sets: result });
  } catch (err) {
    console.error("POST /api/pokemon/canonical-set error:", err);
    return Response.json(
      { error: "Failed to look up canonical sets" },
      { status: 500 },
    );
  }
}
