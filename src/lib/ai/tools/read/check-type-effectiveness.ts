import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getTypeEffectiveness } from "@/lib/pokemon/types";

export const checkTypeEffectivenessTool = new DynamicStructuredTool({
  name: "check_type_effectiveness",
  description:
    "Calculate the type effectiveness multiplier of an attack type against one or more defense types. Returns 0, 0.25, 0.5, 1, 2, or 4.",
  schema: z.object({
    attackType: z.string().describe("The attack type (e.g. 'Fire', 'Water', 'Electric')"),
    defenseTypes: z
      .array(z.string())
      .min(1)
      .max(2)
      .describe("The defending Pokemon's type(s) (e.g. ['Grass', 'Steel'])"),
  }),
  func: async ({ attackType, defenseTypes }) => {
    const multiplier = getTypeEffectiveness(attackType, defenseTypes);

    let description: string;
    if (multiplier === 0) description = "immune (0x)";
    else if (multiplier === 0.25) description = "doubly resisted (0.25x)";
    else if (multiplier === 0.5) description = "resisted (0.5x)";
    else if (multiplier === 1) description = "neutral (1x)";
    else if (multiplier === 2) description = "super effective (2x)";
    else description = "doubly super effective (4x)";

    return JSON.stringify({
      attackType,
      defenseTypes,
      multiplier,
      description,
    });
  },
});
