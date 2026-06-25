import type { TeamPokemon } from "@/lib/types/pokemon";
import { formatTeamForPrompt, teamGrounding } from "./team-format";

/** Prompt for the "Potential changes" panel: roster swaps + per-mon set tweaks
 *  for a team the player is still building. */
export function buildPotentialChangesPrompt(
  team: TeamPokemon[],
  format: string,
): { system: string; user: string } {
  const system = `You are an elite Pokémon VGC team-builder reviewing a doubles team for ${format}. Suggest concrete, immediately-actionable improvements — both roster swaps and per-Pokémon set tweaks. Reason MECHANICALLY about type coverage, speed control, weather, redirection/Fake Out, and the team's shared weaknesses provided to you. Be specific (name actual Pokémon, items, moves, abilities). Do NOT suggest illegal or off-format options.

Respond with ONLY valid JSON matching this exact schema (no prose, no markdown fence):
{
  "swaps": [
    { "title": "<short roster idea, e.g. 'Add a Steel-type'>", "reasoning": "<why — the threat it answers or coverage it adds, 1 sentence>" }
  ],
  "setTweaks": [
    { "species": "<a Pokémon already on the team>", "suggestion": "<a specific move/item/EV/ability change + why, 1 sentence>" }
  ],
  "note": "<optional 1-sentence overall direction>"
}

Guidelines:
- 3-5 swaps, 3-6 setTweaks. Each setTweaks.species MUST be a Pokémon currently on the team.
- Prefer fixes for the listed shared weaknesses and any missing speed control / disruption.
- Keep each string to one tight sentence.`;

  const grounding = teamGrounding(team, format);
  const user = `Format: ${format}

CURRENT TEAM:
${formatTeamForPrompt(team, true)}

MECHANICAL CONTEXT:
${grounding || "(none)"}

Return the potential changes as JSON.`;

  return { system, user };
}
