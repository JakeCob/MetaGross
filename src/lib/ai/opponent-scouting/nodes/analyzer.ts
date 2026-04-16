/**
 * Archetype Analyzer — STUB (Phase 2).
 *
 * Real implementation in Phase 4 will call an LLM with the
 * `opponent_analyzer` persona. For now it infers a rough archetype from
 * known items / abilities via the archetype-keywords data file so the
 * downstream nodes have something plausible to read.
 */
import { matchArchetype } from "@/lib/data/archetype-keywords";
import type { ScoutingStateType, ScoutingStateUpdate } from "../state";

export async function analyzerNode(
  state: ScoutingStateType,
): Promise<Partial<ScoutingStateUpdate>> {
  const species = state.opponentTeam
    .map((p) => p.species ?? "")
    .filter(Boolean);
  const items = state.opponentTeam.map((p) => p.item ?? "").filter(Boolean);
  const abilities = state.opponentTeam
    .map((p) => p.ability ?? "")
    .filter(Boolean);

  // Very rough archetype guess — replaced by LLM in Phase 4.
  let archetype = "balance";
  if (abilities.some((a) => /drizzle/i.test(a))) archetype = "rain";
  else if (abilities.some((a) => /drought/i.test(a))) archetype = "sun";
  else if (abilities.some((a) => /sand stream/i.test(a))) archetype = "sand";
  else if (abilities.some((a) => /snow warning|orichalcum pulse|snowstorm/i.test(a))) archetype = "snow";
  else if (species.some((s) => /farigiraf|hatterene|sinistcha/i.test(s))) archetype = "trick room";

  const synergies: string[] = [];
  if (species.includes("Pelipper") && species.includes("Basculegion"))
    synergies.push("Pelipper + Basculegion (Swift Swim rain sweeper)");
  if (species.includes("Tatsugiri") && species.includes("Dondozo"))
    synergies.push("Tatsugiri + Dondozo (Commander)");
  if (species.includes("Whimsicott") && species.includes("Kingambit"))
    synergies.push("Whimsicott Tailwind + Kingambit Sucker Punch");

  const speedControl: string[] = [];
  if (species.includes("Whimsicott") || species.includes("Pelipper") || species.includes("Tornadus"))
    speedControl.push("Tailwind");
  if (species.includes("Farigiraf") || species.includes("Hatterene") || species.includes("Sinistcha"))
    speedControl.push("Trick Room");
  if (items.some((i) => /choice scarf/i.test(i))) speedControl.push("Choice Scarf");

  // Burn the archetype-keywords file for extra phrase matches. Not needed
  // in Phase 2 but keeps the import honest.
  matchArchetype(archetype);

  return {
    archetype,
    teamSynergies: synergies,
    speedControl,
    history: [
      {
        source: "analyzer",
        summary: `archetype=${archetype}, synergies=${synergies.length}, speedControl=${speedControl.length}`,
        at: Date.now(),
      },
    ],
  };
}
