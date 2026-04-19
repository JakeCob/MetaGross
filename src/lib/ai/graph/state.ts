import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { WriteActionProposal } from "@/lib/types/agent";

/**
 * The LangGraph agent state annotation.
 *
 * `messages` uses the built-in messages reducer so tool calls/results
 * are properly merged into the thread history.
 */
export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  threadId: Annotation<string>(),
  contextType: Annotation<string>(),
  contextId: Annotation<string | null>(),
  persona: Annotation<string>(),
  loadedContext: Annotation<Record<string, unknown> | null>(),
  memoryHits: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  pendingAction: Annotation<WriteActionProposal | null>(),
  /**
   * Counter for the response-verifier → agent correction loop.
   * Capped at 1 retry — if the agent still hallucinates after one
   * correction, we let the response through with the render-time
   * warnings so the user isn't blocked.
   */
  verificationRetries: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),

  /**
   * User-selected provider + model. When unset, the agent node falls
   * back to detectProvider() + its default model. Lets each chat
   * thread override the default via the UI ModelSelector.
   */
  providerOverride: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  modelOverride: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

export type AgentStateType = typeof AgentState.State;
export type AgentStateUpdate = typeof AgentState.Update;
