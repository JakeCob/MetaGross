import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { WriteActionProposal } from "@/lib/types/agent";

export const proposeTeamNoteTool = new DynamicStructuredTool({
  name: "propose_team_note",
  description:
    "Propose updating the notes on a team record. This does NOT execute the write — it returns a proposal for the user to approve, reject, or edit.",
  schema: z.object({
    teamId: z.string().describe("The team ID to update notes for"),
    notes: z.string().describe("The new notes content to set on the team"),
    reason: z.string().describe("Why this note update is being suggested"),
  }),
  func: async ({ teamId, notes, reason }) => {
    const proposal: WriteActionProposal = {
      actionType: "update_team_notes",
      description: reason,
      payload: { teamId, notes },
    };

    return JSON.stringify(proposal);
  },
});
