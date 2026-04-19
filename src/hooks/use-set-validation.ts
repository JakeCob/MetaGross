"use client";

import { useEffect, useRef, useState } from "react";

export interface SetValidationWarning {
  kind:
    | "species-missing"
    | "ability-invalid"
    | "move-invalid"
    | "mega-name-ambiguous"
    | "not-in-format";
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

function cacheKey(
  species: string,
  ability?: string,
  moves?: string[],
  format?: string,
): string {
  const moveKey = moves?.filter(Boolean).map((m) => m.toLowerCase()).sort().join(",") ?? "";
  return [
    species.trim().toLowerCase(),
    (ability ?? "").trim().toLowerCase(),
    moveKey,
    (format ?? "").trim().toLowerCase(),
  ].join("|");
}

/**
 * Lazy-fetch validation for a Pokemon build. Shared cache so 6 cards
 * in a single team render don't fire 6 duplicate requests. Returns
 * null until the first response lands.
 *
 * Pass `format` to enable roster-level validation (Champions Reg M-A
 * by default via the caller).
 */
export function useSetValidation(
  species: string,
  ability?: string,
  moves?: string[],
  format?: string,
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

    const key = cacheKey(species, ability, moves, format);
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
          format: format || undefined,
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
  }, [species, ability, moves, format]);

  return result;
}
