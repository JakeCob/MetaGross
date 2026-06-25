import type { TeamPokemon } from "@/lib/types/pokemon";
import {
  analyzeTeam,
  computeCoreWeaknesses,
  type AITeamMember,
} from "@/lib/team-analysis/team-context";

/** Render a team into the compact "Species | Ability | Item | Moves | EVs" lines
 *  the analysis prompts expect. */
export function formatTeamForPrompt(
  team: (TeamPokemon | Partial<TeamPokemon>)[],
  detailed = true,
): string {
  return team
    .filter((p) => p.species)
    .map((p) => {
      const parts = [p.species as string];
      if (p.ability) parts.push(`Ability: ${p.ability}`);
      if (p.item) parts.push(`Item: ${p.item}`);
      if (detailed && p.nature) parts.push(`Nature: ${p.nature}`);
      if (p.megaEvolution) parts.push(`Mega: ${p.megaEvolution}`);
      const moves = (p.moves ?? []).filter(Boolean);
      if (moves.length) parts.push(`Moves: ${moves.join(", ")}`);
      if (detailed && p.evs) {
        const ev = p.evs;
        const evParts = (
          [
            ["HP", ev.hp],
            ["Atk", ev.atk],
            ["Def", ev.def],
            ["SpA", ev.spa],
            ["SpD", ev.spd],
            ["Spe", ev.spe],
          ] as const
        )
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${v} ${k}`);
        if (evParts.length) parts.push(`EVs: ${evParts.join(" / ")}`);
      }
      return parts.join(" | ");
    })
    .join("\n");
}

/** A short MECHANICAL grounding block (weather/speed mode/mega count + the
 *  team's shared type weaknesses) so the AI critiques structure, not vibes. */
export function teamGrounding(
  team: (TeamPokemon | Partial<TeamPokemon>)[],
  format: string,
): string {
  const members: AITeamMember[] = team
    .filter((p) => p.species)
    .map((p) => ({
      species: p.species as string,
      item: p.item,
      ability: p.ability,
      moves: (p.moves ?? []).filter(Boolean),
    }));
  if (members.length === 0) return "";
  const a = analyzeTeam(members, format);
  const weaknesses = computeCoreWeaknesses(members, format);
  const lines = [
    `Weather: ${a.weather ?? "none"} | Trick Room: ${a.hasTrickRoom} | Tailwind: ${a.hasTailwind} | Megas on team: ${a.megaCount}`,
  ];
  if (weaknesses) lines.push(`Shared type weaknesses: ${weaknesses}`);
  return lines.join("\n");
}
