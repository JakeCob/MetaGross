/**
 * Damage-preview helpers for the battle logger UI.
 *
 * Converts store/scouting state into full TeamPokemon objects so that
 * @smogon/calc (via calculateDamage) can produce inline damage ranges
 * in the ActionMenu and OpponentActionMenu.
 */
import { calculateDamage, type DamageResult } from "./damage-calc";
import type { TeamPokemon, EVSpread, IVSpread } from "@/lib/types/pokemon";
import { DEFAULT_EVS, DEFAULT_IVS } from "@/lib/types/pokemon";
import type { ActivePokemon, FieldState } from "@/lib/types/battle";
import type { PredictedSet } from "@/lib/ai/opponent-scouting/types";
import { CHAMPIONS_POINTS } from "@/lib/data/champions";

// ---------------------------------------------------------------------------
// Resolve an ActivePokemon to a full TeamPokemon (best-effort).
// ---------------------------------------------------------------------------

interface ResolveContext {
  /** Full team for "my" side — always complete sets. */
  myTeam: TeamPokemon[];
  /** Partial team for opponent (from store's opponentTeam). */
  opponentTeam: Partial<TeamPokemon>[];
  /** Scouting predictions, if available — richer than opponentTeam. */
  predictions?: PredictedSet[];
  /** Champions point scale factor. */
  format?: string;
}

/**
 * Build a full TeamPokemon from an ActivePokemon slot.
 *
 * Resolution priority:
 * 1. `myTeam` — for p1 Pokemon, exact match.
 * 2. `predictions` (scouting) — for p2, has predicted ability/item/moves/evs.
 * 3. `opponentTeam` (store) — for p2, whatever the user has revealed.
 * 4. Defaults (31 IVs, 0 EVs, "Hardy") — last resort.
 */
export function resolveToTeamPokemon(
  active: ActivePokemon,
  side: "p1" | "p2",
  ctx: ResolveContext,
): TeamPokemon {
  // --- p1: my team has the exact sets ---
  if (side === "p1") {
    const exact = ctx.myTeam.find((p) => p.species === active.species);
    if (exact) return exact;
  }

  // --- p2: merge scouting prediction + store reveals ---
  const predicted = ctx.predictions?.find((p) => p.species === active.species);
  const store = ctx.opponentTeam.find((p) => p.species === active.species);

  const isChampions = (ctx.format ?? "").toLowerCase().startsWith("champions");

  // Predicted EVs may be in Champions points; @smogon/calc wants
  // traditional 0-252 scale.
  let evs: EVSpread = { ...DEFAULT_EVS };
  if (predicted?.evs) {
    if (predicted.scale === "champions") {
      const f = CHAMPIONS_POINTS.evConversion;
      evs = {
        hp: Math.min(252, predicted.evs.hp * f),
        atk: Math.min(252, predicted.evs.atk * f),
        def: Math.min(252, predicted.evs.def * f),
        spa: Math.min(252, predicted.evs.spa * f),
        spd: Math.min(252, predicted.evs.spd * f),
        spe: Math.min(252, predicted.evs.spe * f),
      };
    } else {
      evs = { ...predicted.evs };
    }
  } else if (isChampions) {
    // No prediction; assume a generic bulky spread so the calc isn't
    // wildly off.
    evs = { hp: 128, atk: 128, def: 0, spa: 128, spd: 0, spe: 128 };
  }

  const ivs: IVSpread = predicted?.ivs ?? { ...DEFAULT_IVS };

  return {
    species: active.species,
    ability: store?.ability || predicted?.ability || "",
    item: store?.item || predicted?.item || "",
    nature: predicted?.nature || store?.nature || "Hardy",
    level: predicted?.level ?? store?.level ?? 50,
    moves: predicted?.moves ?? (store?.moves as [string, string, string, string]) ?? ["", "", "", ""],
    evs,
    ivs,
  };
}

// ---------------------------------------------------------------------------
// Compact preview shape for the UI
// ---------------------------------------------------------------------------

export interface DamagePreview {
  minPercent: number;
  maxPercent: number;
  /** Concise label: "83-98%" or "OHKO (100%)" */
  label: string;
  /** Color key for the UI: green / yellow / red / purple. */
  severity: "safe" | "moderate" | "danger" | "ohko";
  /** Full @smogon/calc one-line description. */
  description: string;
  /** KO chance n (1=OHKO, 2=2HKO, etc). */
  koN: number;
}

/**
 * Run the damage calc and return a compact preview. Requires full
 * TeamPokemon for both sides (use resolveToTeamPokemon first).
 */
export function getDamagePreview(
  attacker: TeamPokemon,
  defender: TeamPokemon,
  moveName: string,
  fieldState?: Partial<FieldState>,
): DamagePreview | null {
  const result = calculateDamage(attacker, defender, moveName, {
    isDoubles: true,
    weather: fieldState?.weather ?? undefined,
    terrain: fieldState?.terrain ?? undefined,
  });
  if (!result) return null;
  return resultToPreview(result);
}

function resultToPreview(r: DamageResult): DamagePreview {
  const min = r.minPercent;
  const max = r.maxPercent;

  let severity: DamagePreview["severity"];
  if (max >= 100) severity = "ohko";
  else if (max >= 80) severity = "danger";
  else if (max >= 50) severity = "moderate";
  else severity = "safe";

  let label: string;
  if (r.koChance.ohko >= 1) label = `OHKO (${max.toFixed(0)}%)`;
  else if (r.koChance.ohko > 0)
    label = `${(r.koChance.ohko * 100).toFixed(0)}% OHKO`;
  else label = `${min.toFixed(0)}-${max.toFixed(0)}%`;

  return {
    minPercent: min,
    maxPercent: max,
    label,
    severity,
    description: r.description,
    koN: r.koChance.n,
  };
}

// ---------------------------------------------------------------------------
// Showdown Calc deep-link
// ---------------------------------------------------------------------------

/**
 * Build a URL that opens calc.pokemonshowdown.com with the
 * attacker/defender pre-filled. The Showdown calc reads state from the
 * hash fragment.
 */
export function buildShowdownCalcUrl(
  attacker: TeamPokemon,
  defender: TeamPokemon,
  moveName?: string,
): string {
  // Showdown calc uses a compact hash-based serialization. The simplest
  // interop is to open the calc with query strings that its JS reads
  // from the URL on load. Unfortunately there's no documented stable
  // URL API; the calc is a single-page app. For now, link to the root
  // and let the user paste the matchup — or we can encode a pokepaste
  // on the clipboard. Keeping this simple: just link to the calc.
  //
  // TODO(Phase 5): reverse-engineer the hash format and pre-fill.
  void attacker;
  void defender;
  void moveName;
  return "https://calc.pokemonshowdown.com/";
}
