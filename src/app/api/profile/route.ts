import { NextResponse } from "next/server";
import { buildPlayerProfile } from "@/lib/profile/build-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/profile — the aggregated player profile (record, preferred
 *  archetypes, win-rate by archetype, most-used Pokémon). */
export async function GET() {
  try {
    const profile = await buildPlayerProfile();
    return NextResponse.json(profile);
  } catch (err) {
    console.error("GET /api/profile error:", err);
    return NextResponse.json(
      { error: "Failed to build player profile." },
      { status: 500 },
    );
  }
}
