import type { AgentStateType, AgentStateUpdate } from "../state";
import { getMemoriesByScope } from "@/lib/db/queries/agent-memories";

/**
 * Graph node: retrieve relevant memories from the long-term memory store.
 * Fetches global, thread-specific, and (if applicable) team-scoped memories.
 */
export async function retrieveMemoryNode(
  state: AgentStateType,
): Promise<Partial<AgentStateUpdate>> {
  const { threadId, contextType, contextId } = state;
  const memoryHits: string[] = [];

  // Always fetch global memories
  const globalMemories = getMemoriesByScope("global");
  for (const mem of globalMemories) {
    if (mem.summary) {
      memoryHits.push(`[global] ${mem.summary}`);
    }
  }

  // Thread-specific memories
  if (threadId) {
    const threadMemories = getMemoriesByScope("thread", threadId);
    for (const mem of threadMemories) {
      if (mem.summary) {
        memoryHits.push(`[thread] ${mem.summary}`);
      }
    }
  }

  // Team-scoped memories
  if (contextType === "team" && contextId) {
    const teamMemories = getMemoriesByScope("team", contextId);
    for (const mem of teamMemories) {
      if (mem.summary) {
        memoryHits.push(`[team] ${mem.summary}`);
      }
    }
  }

  // Match-scoped memories (opponent patterns, matchup knowledge)
  if (contextType === "match" && contextId) {
    const matchupMemories = getMemoriesByScope("matchup", contextId);
    for (const mem of matchupMemories) {
      if (mem.summary) {
        memoryHits.push(`[matchup] ${mem.summary}`);
      }
    }
  }

  return { memoryHits };
}
