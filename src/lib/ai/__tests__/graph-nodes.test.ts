import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../graph/state";

// Server-only modules and the embeddings util must be mocked so the
// retrieve-memory node — which imports them via src/lib/ai/embeddings —
// can load in a jsdom test environment.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/embeddings", () => ({
  embed: vi.fn(async () => null),
  cosine: vi.fn(() => 0),
  keywordScore: vi.fn(() => 0),
  EMBEDDING_MODEL: "text-embedding-3-small",
  EMBEDDING_DIMS: 1536,
}));

// Mock DB queries
vi.mock("@/lib/db/queries/matches", () => ({
  getMatchById: vi.fn(),
  updateMatch: vi.fn(),
}));

vi.mock("@/lib/db/queries/teams", () => ({
  getTeamById: vi.fn(),
  updateTeam: vi.fn(),
}));

vi.mock("@/lib/db/queries/agent-memories", () => ({
  getMemoriesByScope: vi.fn(() => []),
  searchRelevantMemories: vi.fn(() => []),
}));

import { getMatchById } from "@/lib/db/queries/matches";
import { getTeamById } from "@/lib/db/queries/teams";
import { getMemoriesByScope } from "@/lib/db/queries/agent-memories";

function createMockState(overrides?: Partial<AgentStateType>): AgentStateType {
  return {
    messages: [],
    threadId: "test-thread-1",
    contextType: "general",
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
    ...overrides,
  };
}

describe("loadContextNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null loadedContext when no contextId", async () => {
    const { loadContextNode } = await import("../graph/nodes/load-context");
    const state = createMockState({ contextType: "match", contextId: null });
    const result = await loadContextNode(state);
    expect(result.loadedContext).toBeNull();
  });

  it("loads match context when contextType is match", async () => {
    const { loadContextNode } = await import("../graph/nodes/load-context");

    vi.mocked(getMatchById).mockResolvedValue({
      id: "match-1",
      format: "gen9vgc2024regh",
      mode: "bo1",
      result: "win",
      playedAt: 1700000000000,
      opponentName: "Rival",
      notes: null,
      myTeam: [],
      opponentTeam: [],
      myBrought: [],
      opponentBrought: [],
      myLeads: [],
      opponentLeads: [],
      archetypeSelf: "offense",
      archetypeOpponent: "balance",
      ruleAnalysisJson: null,
      aiAnalysisJson: null,
      turns: [{ id: "t1" }, { id: "t2" }],
    } as never);

    const state = createMockState({ contextType: "match", contextId: "match-1" });
    const result = await loadContextNode(state);

    expect(result.loadedContext).not.toBeNull();
    expect(result.loadedContext!.type).toBe("match");
    expect(result.loadedContext!.id).toBe("match-1");
    expect(result.loadedContext!.format).toBe("gen9vgc2024regh");
    expect(result.loadedContext!.turnCount).toBe(2);
  });

  it("loads team context when contextType is team", async () => {
    const { loadContextNode } = await import("../graph/nodes/load-context");

    vi.mocked(getTeamById).mockResolvedValue({
      id: "team-1",
      userId: "user-1",
      name: "Sun Team",
      format: "gen9vgc2024regh",
      notes: "Torkoal + Venusaur core",
      isActive: 1,
      pokepaste: null,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      pokemon: [
        { species: "Torkoal", ability: "Drought", item: "Charcoal", nature: "Quiet", moves: [], evs: {}, ivs: {} },
        { species: "Venusaur", ability: "Chlorophyll", item: "Life Orb", nature: "Modest", moves: [], evs: {}, ivs: {} },
      ],
    } as never);

    const state = createMockState({ contextType: "team", contextId: "team-1" });
    const result = await loadContextNode(state);

    expect(result.loadedContext).not.toBeNull();
    expect(result.loadedContext!.type).toBe("team");
    expect(result.loadedContext!.name).toBe("Sun Team");
    expect((result.loadedContext!.pokemon as unknown[]).length).toBe(2);
  });

  it("returns error context when match not found", async () => {
    const { loadContextNode } = await import("../graph/nodes/load-context");

    vi.mocked(getMatchById).mockResolvedValue(null);

    const state = createMockState({ contextType: "match", contextId: "bad-id" });
    const result = await loadContextNode(state);

    expect(result.loadedContext).not.toBeNull();
    expect(result.loadedContext!.error).toContain("bad-id");
  });
});

describe("retrieveMemoryNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no memories exist", async () => {
    const { retrieveMemoryNode } = await import("../graph/nodes/retrieve-memory");

    vi.mocked(getMemoriesByScope).mockResolvedValue([]);

    const state = createMockState();
    const result = await retrieveMemoryNode(state);
    const hits = result.memoryHits as string[];

    expect(hits).toEqual([]);
  });

  it("fetches global and thread memories", async () => {
    const { retrieveMemoryNode } = await import("../graph/nodes/retrieve-memory");

    vi.mocked(getMemoriesByScope).mockImplementation(async (scope, scopeRef) => {
      if (scope === "global") {
        return [
          { id: "m1", scope: "global", scopeRef: null, kind: "preference", summary: "Prefers aggressive play", content: "", confidence: 0.8, sourceFeedbackId: null, sourceThreadId: null, embedding: null, embeddingModel: null, createdAt: 0, updatedAt: 0 },
        ];
      }
      if (scope === "thread" && scopeRef === "test-thread-1") {
        return [
          { id: "m2", scope: "thread", scopeRef: "test-thread-1", kind: "correction", summary: "Speed calc was wrong for Zacian", content: "", confidence: 0.9, sourceFeedbackId: null, sourceThreadId: null, embedding: null, embeddingModel: null, createdAt: 0, updatedAt: 0 },
        ];
      }
      return [];
    });

    const state = createMockState({ threadId: "test-thread-1" });
    const result = await retrieveMemoryNode(state);
    const hits = result.memoryHits as string[];

    expect(hits).toHaveLength(2);
    expect(hits[0]).toContain("Prefers aggressive play");
    expect(hits[1]).toContain("Speed calc was wrong for Zacian");
  });

  it("fetches team memories when context is team", async () => {
    const { retrieveMemoryNode } = await import("../graph/nodes/retrieve-memory");

    vi.mocked(getMemoriesByScope).mockImplementation(async (scope, scopeRef) => {
      if (scope === "team" && scopeRef === "team-1") {
        return [
          { id: "m3", scope: "team", scopeRef: "team-1", kind: "team_style", summary: "This team is weak to Trick Room", content: "", confidence: 0.7, sourceFeedbackId: null, sourceThreadId: null, embedding: null, embeddingModel: null, createdAt: 0, updatedAt: 0 },
        ];
      }
      return [];
    });

    const state = createMockState({ contextType: "team", contextId: "team-1" });
    const result = await retrieveMemoryNode(state);
    const hits = result.memoryHits as string[];

    expect(hits.some((h: string) => h.includes("Trick Room"))).toBe(true);
  });
});

describe("checkForWrite", () => {
  it("routes to review_write when pendingAction exists", async () => {
    const { checkForWrite } = await import("../graph/nodes/check-for-write");

    const state = createMockState({
      pendingAction: {
        actionType: "update_match_notes",
        description: "Add notes",
        payload: { matchId: "m1", notes: "test" },
      },
      messages: [new HumanMessage("hi")],
    });

    expect(checkForWrite(state)).toBe("review_write");
  });

  it("routes to tool_executor when AI message has tool calls", async () => {
    const { checkForWrite } = await import("../graph/nodes/check-for-write");

    const aiMsg = new AIMessage({
      content: "",
      tool_calls: [{ name: "get_match_context", args: { matchId: "m1" }, id: "tc1", type: "tool_call" }],
    });

    const state = createMockState({
      messages: [new HumanMessage("analyze my match"), aiMsg],
    });

    expect(checkForWrite(state)).toBe("tool_executor");
  });

  it("routes unresolved tool calls before pending write approval", async () => {
    const { checkForWrite } = await import("../graph/nodes/check-for-write");

    const aiMsg = new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "propose_pokemon_patch",
          args: { species: "Milotic" },
          id: "tc1",
          type: "tool_call",
        },
      ],
    });

    const state = createMockState({
      pendingAction: {
        actionType: "patch_team_pokemon",
        description: "Patch Milotic",
        payload: { slot: 0, patch: { species: "Milotic" } },
      },
      messages: [new HumanMessage("change the slot"), aiMsg],
    });

    expect(checkForWrite(state)).toBe("tool_executor");
  });

  it("routes to verify_response when AI message has no tool calls", async () => {
    const { checkForWrite } = await import("../graph/nodes/check-for-write");

    const aiMsg = new AIMessage("Here is my analysis of your match...");

    const state = createMockState({
      messages: [new HumanMessage("analyze my match"), aiMsg],
    });

    // Non-tool-call AI responses now flow through the hallucination
    // verifier before validation.
    expect(checkForWrite(state)).toBe("verify_response");
  });

  it("routes to verify_response when last message is human (edge case)", async () => {
    const { checkForWrite } = await import("../graph/nodes/check-for-write");

    const state = createMockState({
      messages: [new HumanMessage("hello")],
    });

    expect(checkForWrite(state)).toBe("verify_response");
  });
});

describe("checkAfterToolExecution", () => {
  it("routes write tool results directly to approval", async () => {
    const { checkAfterToolExecution } = await import(
      "../graph/nodes/check-for-write"
    );

    const state = createMockState({
      pendingAction: {
        actionType: "patch_team_pokemon",
        description: "Patch Milotic",
        payload: { slot: 0, patch: { species: "Milotic" } },
      },
    });

    expect(checkAfterToolExecution(state)).toBe("review_write");
  });

  it("continues the agent loop after read-only tools", async () => {
    const { checkAfterToolExecution } = await import(
      "../graph/nodes/check-for-write"
    );

    expect(checkAfterToolExecution(createMockState())).toBe("agent");
  });
});

describe("sanitizeMessagesForModel", () => {
  it("keeps complete tool-call blocks", async () => {
    const { sanitizeMessagesForModel } = await import(
      "../graph/message-history"
    );
    const aiMsg = new AIMessage({
      content: "",
      tool_calls: [
        { name: "lookup", args: {}, id: "tc1", type: "tool_call" },
      ],
    });
    const toolMsg = new ToolMessage({
      content: "ok",
      name: "lookup",
      tool_call_id: "tc1",
    });
    const next = new HumanMessage("continue");

    expect(sanitizeMessagesForModel([aiMsg, toolMsg, next])).toEqual([
      aiMsg,
      toolMsg,
      next,
    ]);
  });

  it("drops incomplete tool-call blocks and orphaned tool messages", async () => {
    const { sanitizeMessagesForModel } = await import(
      "../graph/message-history"
    );
    const before = new HumanMessage("start");
    const aiMsg = new AIMessage({
      content: "",
      tool_calls: [
        { name: "lookup_a", args: {}, id: "tc1", type: "tool_call" },
        { name: "lookup_b", args: {}, id: "tc2", type: "tool_call" },
      ],
    });
    const partialToolMsg = new ToolMessage({
      content: "ok",
      name: "lookup_a",
      tool_call_id: "tc1",
    });
    const orphan = new ToolMessage({
      content: "orphan",
      name: "lookup_b",
      tool_call_id: "tc2",
    });
    const after = new HumanMessage("continue");

    expect(
      sanitizeMessagesForModel([before, aiMsg, partialToolMsg, after, orphan]),
    ).toEqual([before, after]);
  });
});
