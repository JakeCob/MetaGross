import type { TeamPokemon } from "@/lib/types/pokemon";
import { getRegulation } from "@/lib/data/champions";
import { formatTeamForPrompt, teamGrounding } from "./team-format";

/** Prompt for the "Potential changes" panel: roster swaps + per-mon set tweaks
 *  for a team the player is still building. */
export function buildPotentialChangesPrompt(
  team: TeamPokemon[],
  format: string,
): { system: string; user: string } {
  // Champions is a restricted, Z-A-era format — the AI doesn't know its legal
  // pool, so feed it the legal held items + the banned ones (the #1 source of
  // illegal suggestions like Assault Vest / Life-Orb-where-banned).
  const reg = getRegulation(format);
  const heldItems = reg.itemsConfirmed
    .filter((i) => !/ite$|ite [XY]$/.test(i)) // drop mega stones from the list
    .join(", ");
  const bannedItems = (reg.itemsBanned ?? []).slice(0, 24).join(", ");

  const system = `You are an elite Pokémon VGC team-builder reviewing a doubles team for ${format}. Suggest concrete, immediately-actionable improvements — both roster swaps and per-Pokémon set tweaks. Reason MECHANICALLY about type coverage, speed control, weather, redirection/Fake Out, and the team's shared weaknesses provided to you. Be specific (name actual Pokémon, items, moves, abilities).

FORMAT LEGALITY (critical — this is a restricted format):
- Held items you MAY suggest: ${heldItems}.
- Items that are BANNED (never suggest): ${bannedItems || "—"}.
- Every Pokémon you suggest adding MUST be legal in ${format}. This is a Legends Z-A-era Champions format with Mega Evolutions — when unsure whether a Pokémon is in the format, do NOT suggest it.

Respond with ONLY valid JSON matching this exact schema (no prose, no markdown fence):
{
  "swaps": [
    { "title": "<short roster idea, e.g. 'Add a Steel-type'>", "reasoning": "<why — the threat it answers or coverage it adds, 1 sentence>", "addMon": "<the specific format-legal Pokémon to add, if this swap names one — else omit>" }
  ],
  "setTweaks": [
    {
      "species": "<a Pokémon already on the team>",
      "suggestion": "<a specific move/item/EV/ability change + why, 1 sentence>",
      "apply": { "item": "<new item>", "ability": "<new ability>", "nature": "<new nature>", "addMove": "<one move to add>" }
    }
  ],
  "note": "<optional 1-sentence overall direction>"
}

Guidelines:
- 3-5 swaps, 3-6 setTweaks. Each setTweaks.species MUST be a Pokémon currently on the team.
- Include "apply" ONLY when the tweak is a concrete, directly-applicable change, and put ONLY the field(s) that change there (a legal item / ability / nature / single move). OMIT "apply" entirely for vague advice ("consider more coverage"). Never invent illegal items/abilities/moves.
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
