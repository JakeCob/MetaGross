import type { AgentStateType, AgentStateUpdate } from "../state";
import { getMatchById } from "@/lib/db/queries/matches";
import { getTeamById } from "@/lib/db/queries/teams";

/**
 * Graph node: load relevant context (match or team) from the database.
 * Stores the loaded data in state.loadedContext for use by the agent node.
 */
export async function loadContextNode(
  state: AgentStateType,
): Promise<Partial<AgentStateUpdate>> {
  const { contextType, contextId } = state;

  if (!contextId) {
    return { loadedContext: null };
  }

  if (contextType === "match") {
    const match = getMatchById(contextId);
    if (!match) {
      return { loadedContext: { error: `Match not found: ${contextId}` } };
    }

    return {
      loadedContext: {
        type: "match",
        id: match.id,
        format: match.format,
        mode: match.mode,
        result: match.result,
        playedAt: match.playedAt,
        opponentName: match.opponentName,
        notes: match.notes,
        myTeam: match.myTeam,
        opponentTeam: match.opponentTeam,
        myBrought: match.myBrought,
        opponentBrought: match.opponentBrought,
        myLeads: match.myLeads,
        opponentLeads: match.opponentLeads,
        archetypeSelf: match.archetypeSelf,
        archetypeOpponent: match.archetypeOpponent,
        ruleAnalysis: match.ruleAnalysisJson,
        aiAnalysis: match.aiAnalysisJson,
        turnCount: match.turns.length,
      },
    };
  }

  if (contextType === "team") {
    const team = getTeamById(contextId);
    if (!team) {
      return { loadedContext: { error: `Team not found: ${contextId}` } };
    }

    return {
      loadedContext: {
        type: "team",
        id: team.id,
        name: team.name,
        format: team.format,
        description: team.description,
        notes: team.notes,
        isActive: team.isActive,
        pokemon: team.pokemon.map((p) => ({
          species: p.species,
          ability: p.ability,
          item: p.item,
          nature: p.nature,
          moves: p.moves,
          evs: p.evs,
          ivs: p.ivs,
          teraType: p.teraType,
        })),
      },
    };
  }

  return { loadedContext: null };
}
