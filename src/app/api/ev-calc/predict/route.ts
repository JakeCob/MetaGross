import { predictEVs } from "@/lib/ev/reverse-calc";
import { getMetaSpreads } from "@/lib/ev/meta-lookup";
import type { DamageObservation, SpeedObservation } from "@/lib/types/ev";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      observations,
      speedObservations,
      species,
      format = ACTIVE_REGULATION_FORMAT_ID,
    } = body as {
      observations: DamageObservation[];
      speedObservations: SpeedObservation[];
      species: string;
      format?: string;
    };

    if (!species) {
      return Response.json(
        { error: "species is required" },
        { status: 400 },
      );
    }

    if (
      (!observations || observations.length === 0) &&
      (!speedObservations || speedObservations.length === 0)
    ) {
      return Response.json(
        { error: "At least one observation (damage or speed) is required" },
        { status: 400 },
      );
    }

    const metaSpreads = getMetaSpreads(species, format);
    const prediction = predictEVs(
      observations ?? [],
      speedObservations ?? [],
      metaSpreads,
    );

    return Response.json({ prediction });
  } catch (error) {
    console.error("EV prediction error:", error);
    return Response.json(
      { error: "Failed to predict EVs" },
      { status: 500 },
    );
  }
}
