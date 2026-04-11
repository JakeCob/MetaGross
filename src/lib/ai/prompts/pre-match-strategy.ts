import type { TeamPokemon } from "@/lib/types/pokemon";

export function buildPreMatchPrompt(
  myTeam: TeamPokemon[],
  opponentTeam: Partial<TeamPokemon>[],
  format: string,
): { system: string; user: string } {
  const system = `You are an expert Pokemon VGC coach preparing a player for a match in Open Team Lists (OTS) format. Both teams are visible before the match starts. You must provide strategic recommendations.

Your response MUST be valid JSON matching this exact schema:
{
  "recommendedLeads": {
    "species": ["<species1>", "<species2>"],
    "reasoning": "<detailed reasoning for this lead>"
  },
  "recommendedBring4": {
    "species": ["<species1>", "<species2>", "<species3>", "<species4>"],
    "reasoning": "<reasoning for the 4 to bring>"
  },
  "gamePlan": "<2-3 sentences describing HOW to win this matchup>",
  "keyThreats": [
    { "species": "<opponent Pokemon>", "threat": "<why it's dangerous and how to handle it>" }
  ],
  "megaTiming": "<advice on when to Mega Evolve, if applicable>",
  "winCondition": "<the primary path to victory>"
}

Guidelines:
- Analyze type matchups, speed tiers, and ability interactions
- Consider common VGC doubles strategies: Fake Out, Intimidate cycling, speed control, redirection
- Recommend leads that have a favorable matchup against likely opponent leads
- The Bring 4 should cover the team's key threats while maintaining synergy
- Game plan should be specific to THIS matchup, not generic
- Key threats are opponent Pokemon that are hardest to deal with
- Consider Mega Evolution timing (turn 1 aggression vs waiting)
- Factor in items, abilities, and move coverage`;

  const formatTeamInfo = (team: (TeamPokemon | Partial<TeamPokemon>)[], detailed: boolean) => {
    return team
      .map((p) => {
        if (!p.species) return "Unknown Pokemon";
        const parts = [p.species];
        if (p.ability) parts.push(`Ability: ${p.ability}`);
        if (p.item) parts.push(`Item: ${p.item}`);
        if (p.nature && detailed) parts.push(`Nature: ${p.nature}`);
        if (p.megaEvolution) parts.push(`Mega: ${p.megaEvolution}`);
        if (p.moves && p.moves.length > 0) {
          const moves = p.moves.filter(Boolean);
          if (moves.length > 0) parts.push(`Moves: ${moves.join(", ")}`);
        }
        if (detailed && p.evs) {
          const evParts: string[] = [];
          if (p.evs.hp > 0) evParts.push(`${p.evs.hp} HP`);
          if (p.evs.atk > 0) evParts.push(`${p.evs.atk} Atk`);
          if (p.evs.def > 0) evParts.push(`${p.evs.def} Def`);
          if (p.evs.spa > 0) evParts.push(`${p.evs.spa} SpA`);
          if (p.evs.spd > 0) evParts.push(`${p.evs.spd} SpD`);
          if (p.evs.spe > 0) evParts.push(`${p.evs.spe} Spe`);
          if (evParts.length > 0) parts.push(`EVs: ${evParts.join(" / ")}`);
        }
        return parts.join(" | ");
      })
      .join("\n");
  };

  const user = `Format: ${format}

MY TEAM (full details):
${formatTeamInfo(myTeam, true)}

OPPONENT'S TEAM (team preview):
${formatTeamInfo(opponentTeam, false)}

Please analyze this matchup and provide your strategic recommendations as JSON.`;

  return { system, user };
}
