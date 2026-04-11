import { z } from "zod";

// ---------------------------------------------------------------------------
// threadCreateSchema
// ---------------------------------------------------------------------------
export const threadCreateSchema = z.object({
  contextType: z.enum(["match", "team", "general"]),
  contextId: z.string().optional(),
  title: z.string().optional(),
  persona: z
    .enum([
      "default",
      "wolfe_glick",
      "cybertron",
      "analyst",
      "aggressive_coach",
      "defensive_coach",
    ])
    .optional(),
});

export type ThreadCreateInput = z.input<typeof threadCreateSchema>;

// ---------------------------------------------------------------------------
// chatMessageSchema
// ---------------------------------------------------------------------------
export const chatMessageSchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
  message: z.string().min(1, "message cannot be empty"),
});

export type ChatMessageInput = z.input<typeof chatMessageSchema>;

// ---------------------------------------------------------------------------
// resumePayloadSchema
// ---------------------------------------------------------------------------
export const resumePayloadSchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
  action: z.enum(["approve", "reject", "edit"]),
  editedPayload: z.unknown().optional(),
});

export type ResumePayloadInput = z.input<typeof resumePayloadSchema>;
