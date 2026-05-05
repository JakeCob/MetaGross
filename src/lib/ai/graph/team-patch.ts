import {
  DEFAULT_EVS,
  DEFAULT_IVS,
  type EVSpread,
  type IVSpread,
  type TeamPokemon,
} from "@/lib/types/pokemon";

export interface PokemonPatchFields {
  species?: string;
  evs?: EVSpread;
  nature?: string;
  moves?: string[];
  item?: string;
  ability?: string;
  teraType?: string | null;
  megaEvolution?: string | null;
}

export interface PokemonPatchPayload {
  teamId?: string;
  species: string;
  slot?: number;
  patch: PokemonPatchFields;
}

export interface PatchableTeamPokemon {
  species: string;
  ability?: string | null;
  item?: string | null;
  nature?: string | null;
  level?: number | null;
  megaEvolution?: string | null;
  teraType?: string | null;
  moves?: unknown;
  evs?: unknown;
  ivs?: unknown;
}

function normalizeMoves(value: unknown): TeamPokemon["moves"] {
  const emptyMoves: TeamPokemon["moves"] = ["", "", "", ""];

  if (Array.isArray(value)) {
    const moves = value
      .map((move) => (typeof move === "string" ? move : ""))
      .slice(0, 4);
    return [
      moves[0] ?? "",
      moves[1] ?? "",
      moves[2] ?? "",
      moves[3] ?? "",
    ];
  }

  if (typeof value === "string") {
    try {
      return normalizeMoves(JSON.parse(value));
    } catch {
      return emptyMoves;
    }
  }

  return emptyMoves;
}

function normalizeStatSpread<T extends EVSpread | IVSpread>(
  value: unknown,
  fallback: T,
): T {
  if (typeof value === "string") {
    try {
      return normalizeStatSpread(JSON.parse(value), fallback);
    } catch {
      return { ...fallback };
    }
  }

  if (!value || typeof value !== "object") {
    return { ...fallback };
  }

  return {
    ...fallback,
    ...(value as Partial<T>),
  };
}

export function normalizePatchablePokemon(
  pokemon: PatchableTeamPokemon,
): TeamPokemon {
  return {
    species: pokemon.species,
    ability: pokemon.ability ?? "",
    item: pokemon.item ?? "",
    nature: pokemon.nature ?? "Hardy",
    level: pokemon.level ?? 50,
    megaEvolution: pokemon.megaEvolution ?? undefined,
    teraType: pokemon.teraType ?? undefined,
    moves: normalizeMoves(pokemon.moves),
    evs: normalizeStatSpread(pokemon.evs, DEFAULT_EVS),
    ivs: normalizeStatSpread(pokemon.ivs, DEFAULT_IVS),
  };
}

function createBlankPokemon(species: string, level: number): TeamPokemon {
  return {
    species,
    ability: "",
    item: "",
    nature: "Hardy",
    level,
    megaEvolution: undefined,
    teraType: undefined,
    moves: ["", "", "", ""],
    evs: { ...DEFAULT_EVS },
    ivs: { ...DEFAULT_IVS },
  };
}

export function applyPokemonPatchToTeam(
  team: PatchableTeamPokemon[],
  payload: PokemonPatchPayload,
): TeamPokemon[] {
  const normalizedTeam = team.map(normalizePatchablePokemon);
  const slotIndex =
    typeof payload.slot === "number" && payload.slot >= 1
      ? payload.slot - 1
      : normalizedTeam.findIndex(
          (pokemon) =>
            pokemon.species.toLowerCase() === payload.species.toLowerCase(),
        );

  if (slotIndex < 0 || slotIndex >= normalizedTeam.length) {
    throw new Error(
      `Could not find ${payload.species} in the current team to patch.`,
    );
  }

  const current = normalizedTeam[slotIndex];
  const nextSpecies = payload.patch.species?.trim();
  const replacingSpecies =
    typeof nextSpecies === "string" &&
    nextSpecies.length > 0 &&
    nextSpecies.toLowerCase() !== current.species.toLowerCase();

  const next = replacingSpecies
    ? createBlankPokemon(nextSpecies, current.level)
    : { ...current };

  if (!replacingSpecies) {
    next.species = current.species;
    next.level = current.level;
  }

  if (payload.patch.ability !== undefined) next.ability = payload.patch.ability;
  if (payload.patch.item !== undefined) next.item = payload.patch.item;
  if (payload.patch.nature !== undefined) next.nature = payload.patch.nature;
  if (payload.patch.moves !== undefined) {
    next.moves = normalizeMoves(payload.patch.moves);
  }
  if (payload.patch.evs !== undefined) {
    next.evs = normalizeStatSpread(payload.patch.evs, DEFAULT_EVS);
  }
  if (payload.patch.teraType !== undefined) {
    next.teraType = payload.patch.teraType ?? undefined;
  }
  if (payload.patch.megaEvolution !== undefined) {
    next.megaEvolution = payload.patch.megaEvolution ?? undefined;
  }

  const updated = [...normalizedTeam];
  updated[slotIndex] = next;
  return updated;
}
