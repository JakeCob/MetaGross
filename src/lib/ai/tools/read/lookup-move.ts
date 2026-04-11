import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getMove } from "@/lib/pokemon/moves";

export const lookupMoveTool = new DynamicStructuredTool({
  name: "lookup_move",
  description:
    "Look up a move by name to get its type, base power, category (Physical/Special/Status), priority, PP, target, and description.",
  schema: z.object({
    moveName: z.string().describe("The move name (e.g. 'Iron Head', 'Protect', 'Tailwind')"),
  }),
  func: async ({ moveName }) => {
    const data = getMove(moveName);

    if (!data) {
      return JSON.stringify({ error: `Move not found: ${moveName}` });
    }

    return JSON.stringify({
      name: data.name,
      type: data.type,
      basePower: data.basePower,
      category: data.category,
      priority: data.priority,
      pp: data.pp,
      target: data.target,
      description: data.description,
    });
  },
});
