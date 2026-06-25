/**
 * Tournament simulation — damage-calc the user's team against the proven teams
 * they're likely to face (top recent Limitless/Labmaus/Victory Road lists). For
 * each opponent we compute, via @smogon/calc:
 *   - how many of their 6 your team can OHKO (offensive pressure)
 *   - how many of YOUR 6 they can OHKO (defensive risk)
 *   - the single biggest threat (attacker/move/target/%)
 *   - a speed read
 * rolled into a 0-100 matchup score, sorted worst-first so the weak matchups
 * you need to prep for surface to the top.
 *
 * Opponent sets come from the real published lists: Limitless teams carry full
 * `pokemon[]`; Labmaus/Victory Road are species-only with a pokepaste link we
 * fetch + parse. EVs default where a list omits them, so treat scores as a rough
 * matchup read, not a battle prediction.
 *
 * SERVER-ONLY.
 */
import "server-only";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { MetaTeam } from "@/lib/meta-teams/types";
import { calculateDamage } from "./damage-calc";
import { getEffectiveSpeed } from "./speed-calc";
import { importTeamFromPaste } from "@/lib/pokemon/sets";
import { fetchPokepasteRaw } from "@/lib/meta-teams/scrapers/pokepaste";
import { listMetaTeams } from "@/lib/meta-teams/queries";

export interface SimThreat {
  attacker: string;
  move: string;
  target: string;
  percent: number;
}

export interface SimMatchup {
  team: {
    id: string;
    source: string;
    author: string | null;
    record: string | null;
    archetype: string | null;
    sourceUrl: string | null;
    species: string[];
  };
  /** 0-100, higher = more favorable for the user. */
  score: number;
  label: "Favorable" | "Even" | "Tricky" | "Hard";
  /** How many of the opponent's 6 your team can OHKO (high roll). */
  youThreaten: number;
  /** How many of YOUR 6 the opponent can OHKO. */
  theyThreaten: number;
  speedNote: string;
  worstThreat: SimThreat | null;
}

export interface SimResult {
  matchups: SimMatchup[];
  opponentsConsidered: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Build a Showdown paste from a MetaTeam's parsed sets (Limitless path). */
function metaTeamToPaste(team: MetaTeam): string {
  return team.pokemon
    .map((p) => {
      const lines = [p.item ? `${p.species} @ ${p.item}` : p.species];
      if (p.ability) lines.push(`Ability: ${p.ability}`);
      lines.push("Level: 50");
      if (p.teraType) lines.push(`Tera Type: ${p.teraType}`);
      if (p.nature) lines.push(`${p.nature} Nature`);
      if (p.evs) lines.push(`EVs: ${p.evs}`);
      for (const mv of p.moves ?? []) if (mv) lines.push(`- ${mv}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

/** Resolve up to `max` proven opponent teams to full TeamPokemon[6]. */
export async function loadOpponentTeams(
  formatId: string,
  max = 8,
  candidatePool = 18,
): Promise<{ meta: MetaTeam; mons: TeamPokemon[] }[]> {
  const list = await listMetaTeams(formatId, candidatePool);
  const resolved = await Promise.all(
    list.map(async (team) => {
      try {
        let mons: TeamPokemon[] = [];
        if (team.pokemon && team.pokemon.length >= 6) {
          mons = importTeamFromPaste(metaTeamToPaste(team));
        } else if (team.sourceUrl && /pokepast\.es/i.test(team.sourceUrl)) {
          const raw = await fetchPokepasteRaw(team.sourceUrl);
          if (raw) mons = importTeamFromPaste(raw);
        }
        return mons.length >= 6 ? { meta: team, mons: mons.slice(0, 6) } : null;
      } catch {
        return null;
      }
    }),
  );
  return resolved.filter((r): r is { meta: MetaTeam; mons: TeamPokemon[] } => r !== null).slice(0, max);
}

/** Best damage one attacker can do to one defender across its moves (doubles). */
function bestHit(att: TeamPokemon, def: TeamPokemon): { maxPercent: number; canOHKO: boolean; move: string } {
  let maxPercent = 0;
  let canOHKO = false;
  let move = "";
  for (const mv of (att.moves ?? []).filter(Boolean)) {
    const r = calculateDamage(att, def, mv, { isDoubles: true });
    if (!r) continue;
    if (r.maxPercent > maxPercent) {
      maxPercent = r.maxPercent;
      move = mv;
    }
    if (r.maxPercent >= 100) canOHKO = true;
  }
  return { maxPercent, canOHKO, move };
}

export function scoreMatchup(
  user: TeamPokemon[],
  opp: TeamPokemon[],
  meta: MetaTeam,
): SimMatchup {
  // Offense: opp mons the user can OHKO.
  let youThreaten = 0;
  for (const d of opp) {
    if (user.some((a) => bestHit(a, d).canOHKO)) youThreaten++;
  }

  // Defense: user mons the opp can OHKO + the single biggest incoming hit.
  let theyThreaten = 0;
  let worst: SimThreat | null = null;
  for (const d of user) {
    let koed = false;
    for (const a of opp) {
      const b = bestHit(a, d);
      if (b.canOHKO) koed = true;
      if (!worst || b.maxPercent > worst.percent) {
        worst = { attacker: a.species, move: b.move, target: d.species, percent: Math.round(b.maxPercent) };
      }
    }
    if (koed) theyThreaten++;
  }

  // Speed: how many of yours outspeed their fastest (no field effects).
  const oppFastest = Math.max(...opp.map((m) => getEffectiveSpeed(m)));
  const youOutspeedTheirFastest = user.filter((m) => getEffectiveSpeed(m) > oppFastest).length;
  const speedBonus = youOutspeedTheirFastest >= 3 ? 6 : youOutspeedTheirFastest >= 1 ? 2 : -4;
  const speedNote = `${youOutspeedTheirFastest}/6 of yours outspeed their fastest (${oppFastest} Spe)`;

  const score = clamp(Math.round(50 + (youThreaten - theyThreaten) * 7 + speedBonus), 3, 97);
  const label: SimMatchup["label"] =
    score >= 64 ? "Favorable" : score >= 47 ? "Even" : score >= 32 ? "Tricky" : "Hard";

  return {
    team: {
      id: meta.id,
      source: meta.source,
      author: meta.author,
      record: meta.record,
      archetype: meta.archetype,
      sourceUrl: meta.sourceUrl,
      species: meta.species,
    },
    score,
    label,
    youThreaten,
    theyThreaten,
    speedNote,
    worstThreat: worst,
  };
}

export async function simulateVsProvenTeams(
  userTeam: TeamPokemon[],
  formatId: string,
  max = 8,
): Promise<SimResult> {
  const opponents = await loadOpponentTeams(formatId, max);
  const matchups = opponents.map((o) => scoreMatchup(userTeam, o.mons, o.meta));
  matchups.sort((a, b) => a.score - b.score); // worst matchups first
  return { matchups, opponentsConsidered: opponents.length };
}
