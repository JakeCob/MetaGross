/**
 * Regression tests for the EV-format auto-rewriter in the
 * verifier node. Prompt-level rules weren't enough to stop the
 * agent from emitting 252/4 spreads; these tests lock in the
 * deterministic fix.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { verifyResponseNode } from "../graph/nodes/verify-response";
import type { AgentStateType } from "../graph/state";

function stateFor(content: string): AgentStateType {
  return {
    messages: [
      new HumanMessage("x"),
      new AIMessage({ id: "resp", content }),
    ],
    threadId: "t",
    contextType: "team",
    contextId: null,
    persona: "default",
    loadedContext: null,
    memoryHits: [],
    pendingAction: null,
    verificationRetries: 0,
    providerOverride: null,
    modelOverride: null,
    draftTeam: null,
    extractedMemoriesThisTurn: [],
  };
}

describe("verifyResponseNode — EV rewriter", () => {
  it("converts 252/4 style EV strings to Champions 66/32", async () => {
    const input = `### Conkeldurr\nAbility: Guts\nEVs: 252 HP / 252 Atk / 4 SpD\nMoves: Drain Punch / Facade / Mach Punch / Protect`;
    const update = await verifyResponseNode(stateFor(input));
    const rewritten = String((update.messages as AIMessage[] | undefined)?.[0]?.content ?? "");
    // Every stat ≤32 and no raw "252" left.
    expect(rewritten).not.toMatch(/\b252\b/);
    expect(rewritten).toMatch(/HP 32/);
    expect(rewritten).toMatch(/Atk 32/);
  });

  it("converts the mixed 244/4/252/4/4 spread", async () => {
    const input = `### Primarina\nAbility: Liquid Voice\nEVs: 244 HP / 4 Def / 252 SpA / 4 SpD / 4 Spe\nMoves: Hyper Voice / Moonblast / Calm Mind / Protect`;
    const update = await verifyResponseNode(stateFor(input));
    const rewritten = String((update.messages as AIMessage[] | undefined)?.[0]?.content ?? "");
    expect(rewritten).toMatch(/HP 31/);
    expect(rewritten).toMatch(/SpA 32/);
    // Small values get collapsed to 0 or 1 via Math.round
    expect(rewritten).not.toMatch(/\b244\b|\b252\b/);
  });

  it("leaves already-Champions-format lines alone", async () => {
    const input = `### Scovillain\nAbility: Spicy Spray\nPoints: HP 32 / Atk 0 / Def 24 / SpA 0 / SpD 10 / Spe 0\nMoves: Overheat / Leech Seed / Rage Powder / Protect`;
    const update = await verifyResponseNode(stateFor(input));
    // No rewrite needed → no message replacement at all.
    expect(update.messages).toBeFalsy();
  });

  it("emits all 6 stats in canonical order even when input is partial", async () => {
    const input = `### Conkeldurr\nAbility: Guts\nEVs: 252 HP / 252 Atk\nMoves: Drain Punch`;
    const update = await verifyResponseNode(stateFor(input));
    const rewritten = String((update.messages as AIMessage[] | undefined)?.[0]?.content ?? "");
    expect(rewritten).toMatch(/HP 32 \/ Atk 32 \/ Def 0 \/ SpA 0 \/ SpD 0 \/ Spe 0/);
  });

  it("flags prose-only allowlist misses like Heatran for a retry", async () => {
    const input = `You can keep Milotic, replace Incineroar, and use Heatran as your Mega Scizor answer.`;
    const update = await verifyResponseNode(stateFor(input));
    const correction = Array.isArray(update.messages)
      ? update.messages[0]
      : undefined;
    expect(correction).toBeTruthy();
    expect(correction?._getType()).toBe("human");
    expect(String(correction?.content ?? "")).toContain("Heatran");
    expect(update.verificationRetries).toBe(1);
  });

  it("forces patch mode on direct edit requests instead of allowing a full rebuild", async () => {
    const update = await verifyResponseNode({
      ...stateFor(`### Farigiraf
- **Role**: Anti-priority support

### Talonflame
- **Role**: Speed control

### Floette-Eternal
- **Role**: Fairy support

### Milotic
- **Role**: Bulky water

### Garchomp
- **Role**: Physical pressure

### Sneasler
- **Role**: Cleaner`),
      messages: [
        new HumanMessage(
          "I think I could add Farigiraf and I don't use Incineroar much, maybe let's replace it, but keep Milotic.",
        ),
        new AIMessage({
          id: "resp",
          content: `### Farigiraf
- **Role**: Anti-priority support

### Talonflame
- **Role**: Speed control

### Floette-Eternal
- **Role**: Fairy support

### Milotic
- **Role**: Bulky water

### Garchomp
- **Role**: Physical pressure

### Sneasler
- **Role**: Cleaner`,
        }),
      ],
      draftTeam: {
        name: "Bulaklak",
        format: "Champions Reg M-A",
        pokemon: [
          { species: "Floette-Eternal" },
          { species: "Milotic" },
          { species: "Garchomp" },
          { species: "Talonflame" },
          { species: "Sneasler" },
          { species: "Incineroar" },
        ],
      },
    });

    const correction = Array.isArray(update.messages)
      ? update.messages[0]
      : undefined;
    expect(correction).toBeTruthy();
    expect(String(correction?.content ?? "")).toContain("direct edit request");
  });

  it("rejects confirmation-loop replies on clear edit requests", async () => {
    const update = await verifyResponseNode({
      ...stateFor("Do you agree to replace incineroar with Farigiraf? Do a deep analysis"),
      messages: [
        new HumanMessage(
          "Replace Incineroar with Farigiraf and keep the rest of my team the same.",
        ),
        new AIMessage({
          id: "resp",
          content:
            "Do you agree to replace incineroar with Farigiraf? Do a deep analysis",
        }),
      ],
      draftTeam: {
        name: "Bulaklak",
        format: "Champions Reg M-A",
        pokemon: [
          { species: "Floette-Eternal" },
          { species: "Milotic" },
          { species: "Garchomp" },
          { species: "Talonflame" },
          { species: "Sneasler" },
          { species: "Incineroar" },
        ],
      },
    });

    const correction = Array.isArray(update.messages)
      ? update.messages[0]
      : undefined;
    expect(correction).toBeTruthy();
    expect(String(correction?.content ?? "")).toContain(
      "Do NOT ask the user to confirm",
    );
  });
});
