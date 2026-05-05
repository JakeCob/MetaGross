import { describe, expect, it, vi } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../graph/state";

vi.mock("server-only", () => ({}));

function stateFor(): AgentStateType {
  return {
    messages: [
      new HumanMessage(
        "Or let's just add Dragon Tail again on Milotic to counter Trick Room.",
      ),
      new AIMessage({
        id: "resp",
        content: "Proposed replacing Milotic's Haze with Dragon Tail — approve to apply.",
      }),
    ],
    threadId: "t",
    contextType: "team",
    contextId: null,
    persona: "default",
    loadedContext: null,
    memoryHits: [],
    pendingAction: {
      actionType: "patch_team_pokemon",
      description: "Replace Milotic's Haze with Dragon Tail.",
      payload: {
        species: "Milotic",
        patch: {
          moves: ["Scald", "Recover", "Dragon Tail", "Ice Beam"],
        },
      },
    },
    verificationRetries: 0,
    providerOverride: null,
    modelOverride: null,
    draftTeam: {
      name: "Bulaklak",
      format: "Champions Reg M-A",
      pokemon: [{ species: "Milotic", moves: ["Scald", "Recover", "Haze", "Ice Beam"] }],
    },
    extractedMemoriesThisTurn: [],
  };
}

describe("reviewWriteNode", () => {
  it("does not interrupt for tentative edit suggestions", async () => {
    const { reviewWriteNode } = await import("../graph/nodes/review-write");

    const result = await reviewWriteNode(stateFor());
    expect(result.pendingAction).toBeNull();
    const messages = Array.isArray(result.messages) ? result.messages : [];
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0]?._getType()).toBe("human");
    expect(String(messages[0]?.content ?? "")).toContain(
      "Do NOT call propose_pokemon_patch",
    );
  });
});
