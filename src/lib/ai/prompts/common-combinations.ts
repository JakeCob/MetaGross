import type { TeamPokemon } from "@/lib/types/pokemon";
import { formatTeamForPrompt, teamGrounding } from "./team-format";

/** Prompt for the "Common combinations" panel: strong lead + back-line combos
 *  drawn from the player's own team, each with a 1-2 sentence gameplan. */
export function buildCommonCombinationsPrompt(
  team: TeamPokemon[],
  format: string,
): { system: string; user: string } {
  const system = `You are an elite Pokémon VGC doubles strategist for ${format}. Given a team, identify the strongest LEAD pairs and the back-line they enable, with a concrete turn-1 gameplan for each. Reason MECHANICALLY: Fake Out / redirection (Follow Me, Rage Powder), speed control (Tailwind / Trick Room), weather, Intimidate, and immediate KO pressure. Use ONLY Pokémon that are on the provided team.

Respond with ONLY valid JSON matching this exact schema (no prose, no markdown fence):
{
  "combos": [
    {
      "leads": ["<teamMon>", "<teamMon>"],
      "back": ["<teamMon>", "<teamMon>"],
      "strategy": "<1-2 sentences: the turn-1 plan + how the back-line closes>"
    }
  ],
  "note": "<optional 1-sentence caveat, e.g. 'not exhaustive — solid starting combos'>"
}

Guidelines:
- 2-4 combos. Each leads/back entry MUST be a Pokémon on the team (no duplicates within a combo).
- Make the leads genuinely synergize with each other (e.g. Fake Out + setup, redirection + spread, weather + abuser).
- Strategy must be specific to these Pokémon, citing actual moves/abilities.`;

  const grounding = teamGrounding(team, format);
  const user = `Format: ${format}

TEAM:
${formatTeamForPrompt(team, true)}

MECHANICAL CONTEXT:
${grounding || "(none)"}

Return the best lead + back combinations as JSON.`;

  return { system, user };
}
