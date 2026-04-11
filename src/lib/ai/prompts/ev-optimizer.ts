import type { TeamPokemon } from "@/lib/types/pokemon";

export function buildEVOptimizerPrompt(
  team: TeamPokemon[],
  metaThreats: { species: string; usagePercent: number }[],
): { system: string; user: string } {
  const system = `You are an expert Pokemon VGC teambuilder specializing in EV spread optimization. You analyze teams holistically to suggest EV spreads that account for the full team composition and meta threats.

Your response MUST be valid JSON array matching this exact schema:
[
  {
    "pokemon": "<species name>",
    "spread": { "hp": <0-252>, "atk": <0-252>, "def": <0-252>, "spa": <0-252>, "spd": <0-252>, "spe": <0-252> },
    "nature": "<nature name>",
    "reasoning": "<detailed reasoning for this spread>",
    "source": "ai_optimized"
  }
]

Guidelines:
- Total EVs per Pokemon MUST equal exactly 510 (or less)
- Each individual stat MUST be 0-252
- Consider the Pokemon's role on the team (sweeper, support, tank, etc.)
- Consider what threats each Pokemon needs to handle based on the meta
- Factor in speed tiers: specific benchmarks to outspeed or underspeed
- Factor in survival benchmarks: surviving specific hits from meta threats
- Factor in KO benchmarks: ensuring KOs on key targets
- Consider the team composition: if another teammate handles a threat, you can invest elsewhere
- Prefer practical EV numbers (multiples of 4 for the last point are most efficient)
- Provide clear reasoning referencing specific threats and benchmarks`;

  const teamInfo = team
    .map((p) => {
      const evParts: string[] = [];
      if (p.evs.hp > 0) evParts.push(`${p.evs.hp} HP`);
      if (p.evs.atk > 0) evParts.push(`${p.evs.atk} Atk`);
      if (p.evs.def > 0) evParts.push(`${p.evs.def} Def`);
      if (p.evs.spa > 0) evParts.push(`${p.evs.spa} SpA`);
      if (p.evs.spd > 0) evParts.push(`${p.evs.spd} SpD`);
      if (p.evs.spe > 0) evParts.push(`${p.evs.spe} Spe`);

      return `${p.species} @ ${p.item}
  Ability: ${p.ability}
  Nature: ${p.nature}
  Moves: ${p.moves.join(", ")}
  Current EVs: ${evParts.join(" / ") || "None"}
  ${p.megaEvolution ? `Mega: ${p.megaEvolution}` : ""}`;
    })
    .join("\n\n");

  const threatList = metaThreats
    .slice(0, 15) // top 15 threats
    .map((t) => `${t.species} (${t.usagePercent}% usage)`)
    .join(", ");

  const user = `TEAM:
${teamInfo}

TOP META THREATS:
${threatList}

Please suggest optimized EV spreads for each Pokemon on this team, considering their roles and the meta threats they need to handle. Return as JSON array.`;

  return { system, user };
}
