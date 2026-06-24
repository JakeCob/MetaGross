/**
 * EV-optimization pass for a finished debate team.
 *
 * Runs the full multi-agent EV optimizer (ev-debate: Wolfe/Cybertron personas +
 * damage-calc benchmark sims) on every member and merges the benchmarked spread
 * + nature onto each. Exposed as an async GENERATOR so the streaming team-debate
 * can surface real per-batch progress to the UI (the EV phase is the long,
 * previously-silent ~10-15 min stretch). Lives outside the LangGraph node so the
 * graph stays pure and this phase can stream independently.
 */
import { optimizeEVSpread } from "@/lib/ai/ev-debate";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { DraftMember } from "./state";

const FLAT_IVS = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
const ZERO_EVS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

/** Optimize at most this many members at once — 6 simultaneous EV debates
 *  (~30 LLM calls) stampede provider rate limits and leave members un-optimized. */
export const EV_CONCURRENCY = 2;

export interface EvProgress {
  /** Members whose EVs are finished. */
  done: number;
  total: number;
  /** Species currently being optimized (the in-flight batch). */
  optimizing: string[];
}

/** Build a TeamPokemon (the EV optimizer's input shape) from a draft member. */
function draftToTeamPokemon(m: DraftMember): TeamPokemon {
  return {
    species: m.species,
    ability: m.ability ?? "",
    item: m.item ?? "",
    nature: m.nature ?? "Hardy",
    level: 50,
    moves: [
      m.moves?.[0] ?? "",
      m.moves?.[1] ?? "",
      m.moves?.[2] ?? "",
      m.moves?.[3] ?? "",
    ],
    evs: m.evs ?? ZERO_EVS,
    ivs: FLAT_IVS,
  };
}

/** Optimize one member's EVs, retrying once on a transient failure (rate limit /
 *  abort). Falls back to the un-optimized member if both attempts fail. */
async function optimizeOne(
  m: DraftMember,
  others: TeamPokemon[],
  format: string,
): Promise<DraftMember> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await optimizeEVSpread(draftToTeamPokemon(m), others, format);
      return { ...m, nature: res.nature, evs: res.spread };
    } catch {
      // retry once, then keep the member as-is
    }
  }
  return m;
}

/**
 * Stream the EV optimization of a team, EV_CONCURRENCY at a time. Yields a
 * snapshot before each batch (the batch's species in `optimizing`) and after it
 * completes (those members now carry evs/nature). The final yield has
 * `done === total` and the fully-optimized members.
 */
export async function* optimizeTeamEVsStream(
  team: DraftMember[],
  format: string,
): AsyncGenerator<{ progress: EvProgress; members: DraftMember[] }> {
  const total = team.length;
  const out = [...team];
  if (total === 0) {
    yield { progress: { done: 0, total: 0, optimizing: [] }, members: out };
    return;
  }

  for (let start = 0; start < total; start += EV_CONCURRENCY) {
    const end = Math.min(start + EV_CONCURRENCY, total);
    const optimizing = team.slice(start, end).map((m) => m.species);
    // Announce the batch (⏳ on these members).
    yield { progress: { done: start, total, optimizing }, members: [...out] };

    await Promise.all(
      Array.from({ length: end - start }, (_, k) => {
        const i = start + k;
        const others = team.filter((_, j) => j !== i).map(draftToTeamPokemon);
        return optimizeOne(team[i], others, format).then((r) => {
          out[i] = r;
        });
      }),
    );

    // Batch done (✓ on these members).
    yield { progress: { done: end, total, optimizing: [] }, members: [...out] };
  }
}
