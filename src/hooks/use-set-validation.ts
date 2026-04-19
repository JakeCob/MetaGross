"use client";

import { useEffect, useRef, useState } from "react";

export interface SetValidationWarning {
  kind:
    | "species-missing"
    | "ability-invalid"
    | "move-invalid"
    | "mega-name-ambiguous";
  message: string;
  expected?: string[];
}

export interface SetValidationResult {
  resolvedSpecies: string | null;
  speciesAbilities: string[];
  warnings: SetValidationWarning[];
}

const validationCache = new Map<string, SetValidationResult>();
const inflight = new Map<string, Promise<SetValidationResult | null>>();

function cacheKey(species: string, ability?: string, moves?: string[]): string {
  const moveKey = moves?.filter(Boolean).map((m) => m.toLowerCase()).sort().join(",") ?? "";
  return [
    species.trim().toLowerCase(),
    (ability ?? "").trim().toLowerCase(),
    moveKey,
  ].join("|");
}

/**
 * Lazy-fetch validation for a Pokemon build. Shared cache so 6 cards
 * in a single team render don't fire 6 duplicate requests. Returns
 * null until the first response lands.
 */
export function useSetValidation(
  species: string,
  ability?: string,
  moves?: string[],
): SetValidationResult | null {
  const [result, setResult] = useState<SetValidationResult | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!species?.trim()) {
      setResult(null);
      return;
    }

    const key = cacheKey(species, ability, moves);
    const cached = validationCache.get(key);
    if (cached) {
      setResult(cached);
      return;
    }

    let existing = inflight.get(key);
    if (!existing) {
      existing = fetch("/api/pokemon/validate-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          species,
          ability: ability || undefined,
          moves: moves && moves.length > 0 ? moves : undefined,
        }),
      })
        .then(async (res) => {
          if (!res.ok) return null;
          const data = (await res.json()) as SetValidationResult;
          validationCache.set(key, data);
          return data;
        })
        .catch(() => null)
        .finally(() => {
          inflight.delete(key);
        });
      inflight.set(key, existing);
    }

    existing.then((data) => {
      if (!mountedRef.current) return;
      setResult(data);
    });
  }, [species, ability, moves]);

  return result;
}
