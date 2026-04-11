import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { WriteActionProposal } from "@/lib/types/agent";

export const proposeMatchNoteTool = new DynamicStructuredTool({
  name: "propose_match_note",
  description:
    "Propose updating the notes on a match record. This does NOT execute the write — it returns a proposal for the user to approve, reject, or edit.",
  schema: z.object({
    matchId: z.string().describe("The match ID to update notes for"),
    notes: z.string().describe("The new notes content to set on the match"),
    reason: z.string().describe("Why this note update is being suggested"),
  }),
  func: async ({ matchId, notes, reason }) => {
    const proposal: WriteActionProposal = {
      actionType: "update_match_notes",
      description: reason,
      payload: { matchId, notes },
    };

    return JSON.stringify(proposal);
  },
});
