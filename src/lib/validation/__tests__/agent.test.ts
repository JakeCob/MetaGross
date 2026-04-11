import { describe, it, expect } from "vitest";
import {
  threadCreateSchema,
  chatMessageSchema,
  resumePayloadSchema,
} from "../agent";

describe("threadCreateSchema", () => {
  it("accepts valid input with all fields", () => {
    const result = threadCreateSchema.safeParse({
      contextType: "match",
      contextId: "abc-123",
      title: "Analysis of Match 1",
      persona: "wolfe_glick",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contextType).toBe("match");
      expect(result.data.contextId).toBe("abc-123");
      expect(result.data.title).toBe("Analysis of Match 1");
      expect(result.data.persona).toBe("wolfe_glick");
    }
  });

  it("accepts valid input with only required fields", () => {
    const result = threadCreateSchema.safeParse({
      contextType: "general",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contextType).toBe("general");
      expect(result.data.contextId).toBeUndefined();
      expect(result.data.title).toBeUndefined();
      expect(result.data.persona).toBeUndefined();
    }
  });

  it("accepts all valid contextType values", () => {
    for (const contextType of ["match", "team", "general"]) {
      const result = threadCreateSchema.safeParse({ contextType });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all valid persona values", () => {
    const personas = [
      "default",
      "wolfe_glick",
      "cybertron",
      "analyst",
      "aggressive_coach",
      "defensive_coach",
    ];
    for (const persona of personas) {
      const result = threadCreateSchema.safeParse({
        contextType: "general",
        persona,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid contextType", () => {
    const result = threadCreateSchema.safeParse({
      contextType: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid persona", () => {
    const result = threadCreateSchema.safeParse({
      contextType: "match",
      persona: "unknown_persona",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing contextType", () => {
    const result = threadCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("chatMessageSchema", () => {
  it("accepts valid input", () => {
    const result = chatMessageSchema.safeParse({
      threadId: "thread-abc-123",
      message: "What are my options against Incineroar?",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.threadId).toBe("thread-abc-123");
      expect(result.data.message).toBe("What are my options against Incineroar?");
    }
  });

  it("rejects empty threadId", () => {
    const result = chatMessageSchema.safeParse({
      threadId: "",
      message: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty message", () => {
    const result = chatMessageSchema.safeParse({
      threadId: "thread-abc-123",
      message: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing threadId", () => {
    const result = chatMessageSchema.safeParse({
      message: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing message", () => {
    const result = chatMessageSchema.safeParse({
      threadId: "thread-abc-123",
    });
    expect(result.success).toBe(false);
  });
});

describe("resumePayloadSchema", () => {
  it("accepts valid approve action", () => {
    const result = resumePayloadSchema.safeParse({
      threadId: "thread-abc-123",
      action: "approve",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action).toBe("approve");
    }
  });

  it("accepts valid reject action", () => {
    const result = resumePayloadSchema.safeParse({
      threadId: "thread-abc-123",
      action: "reject",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid edit action with editedPayload", () => {
    const result = resumePayloadSchema.safeParse({
      threadId: "thread-abc-123",
      action: "edit",
      editedPayload: { notes: "Updated notes content" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action).toBe("edit");
      expect(result.data.editedPayload).toEqual({ notes: "Updated notes content" });
    }
  });

  it("rejects invalid action", () => {
    const result = resumePayloadSchema.safeParse({
      threadId: "thread-abc-123",
      action: "cancel",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty threadId", () => {
    const result = resumePayloadSchema.safeParse({
      threadId: "",
      action: "approve",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing action", () => {
    const result = resumePayloadSchema.safeParse({
      threadId: "thread-abc-123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing threadId", () => {
    const result = resumePayloadSchema.safeParse({
      action: "approve",
    });
    expect(result.success).toBe(false);
  });
});
