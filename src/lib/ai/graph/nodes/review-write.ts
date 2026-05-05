import { interrupt } from "@langchain/langgraph";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { AgentStateType, AgentStateUpdate } from "../state";
import type { WriteActionProposal } from "@/lib/types/agent";
import { updateMatch } from "@/lib/db/queries/matches";
import { getTeamById, updateTeam } from "@/lib/db/queries/teams";
import {
  applyPokemonPatchToTeam,
  type PokemonPatchPayload,
} from "../team-patch";
import {
  getLatestUserMessageText,
  isTentativeTeamEditSuggestion,
} from "../edit-intent";

interface ResumeDecision {
  action: "approve" | "reject" | "edit";
  editedPayload?: unknown;
}

/**
 * Execute the actual write operation after user approval.
 */
async function executeWriteAction(
  proposal: WriteActionProposal,
  editedPayload?: unknown,
): Promise<string> {
  const payload = editedPayload ?? proposal.payload;

  switch (proposal.actionType) {
    case "update_match_notes": {
      const data = payload as { matchId: string; notes: string };
      const result = updateMatch(data.matchId, { notes: data.notes });
      if (!result) return "Failed to update match notes — match not found.";
      return `Match notes updated successfully.`;
    }

    case "update_team_notes": {
      const data = payload as { teamId: string; notes: string };
      const result = updateTeam(data.teamId, { notes: data.notes });
      if (!result) return "Failed to update team notes — team not found.";
      return `Team notes updated successfully.`;
    }

    case "create_team_variant": {
      // For now, creating a variant is just creating a note about the variant
      // Full implementation would create a new team entry
      return `Team variant proposal noted. Full team creation is not yet implemented in the agent.`;
    }

    case "patch_team_pokemon": {
      const data = payload as PokemonPatchPayload;

      // Unsaved draft-team patches are applied locally in the TeamBuilder
      // UI after approval. The graph still needs a success message so the
      // interruption completes cleanly.
      if (!data.teamId) {
        return `Draft team patch approved.`;
      }

      const currentTeam = getTeamById(data.teamId);
      if (!currentTeam) return "Failed to patch team — team not found.";

      const nextPokemon = applyPokemonPatchToTeam(currentTeam.pokemon, data);
      const result = updateTeam(data.teamId, { pokemon: nextPokemon });
      if (!result) return "Failed to patch team — team not found.";
      return `Team pokemon updated successfully.`;
    }

    default:
      return `Unknown action type: ${proposal.actionType}`;
  }
}

/**
 * Graph node: interrupt for human approval, then execute (or cancel) the write.
 *
 * Uses LangGraph's interrupt() to pause execution. The interrupt value is the
 * WriteActionProposal for the UI to display. When the graph is resumed via
 * Command({ resume: decision }), execution continues here and the write is
 * performed or cancelled based on the decision.
 */
export async function reviewWriteNode(
  state: AgentStateType,
): Promise<Partial<AgentStateUpdate>> {
  const proposal = state.pendingAction;

  if (!proposal) {
    return { pendingAction: null };
  }

  if (proposal.actionType === "patch_team_pokemon") {
    const latestUserMessage = getLatestUserMessageText(state.messages);
    if (isTentativeTeamEditSuggestion(latestUserMessage)) {
      return {
        pendingAction: null,
        messages: [
          new HumanMessage(
            "[VERIFIER] The user's latest message floated a possible team change as an option under discussion, not a clear instruction to apply it. Do NOT call propose_pokemon_patch on this turn. Answer the analysis first, explain the tradeoffs, and wait for an explicit apply request before opening an approval card.",
          ),
        ],
      };
    }
  }

  // Interrupt execution — the proposal is sent to the client.
  // When resumed, `decision` will be the Command.resume value.
  const decision = interrupt<WriteActionProposal, ResumeDecision>(proposal);

  // After resume: process the user's decision
  if (decision.action === "reject") {
    return {
      pendingAction: null,
      messages: [
        new AIMessage(
          `Action cancelled: "${proposal.description}". Let me know if you'd like me to do something else.`,
        ),
      ],
    };
  }

  if (decision.action === "approve" || decision.action === "edit") {
    const resultMsg = await executeWriteAction(
      proposal,
      decision.action === "edit" ? decision.editedPayload : undefined,
    );

    return {
      pendingAction: null,
      messages: [new AIMessage(resultMsg)],
    };
  }

  // Fallback
  return { pendingAction: null };
}
