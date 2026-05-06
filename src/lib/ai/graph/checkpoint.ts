import { MemorySaver } from "@langchain/langgraph";

/**
 * Create an in-process checkpoint store for LangGraph agent threads.
 *
 * Why MemorySaver and not SqliteSaver: better-sqlite3 needs a writable
 * filesystem and the Vercel serverless runtime doesn't have one. The
 * Turso/libSQL migration covers the main app DB but LangGraph doesn't
 * ship a libSQL-backed checkpoint saver, so we fall back to in-memory
 * state. Threads survive within a single warm invocation but reset on
 * cold-starts — acceptable for the single-user MVP. Swap to a custom
 * libSQL saver here when persistent threads matter.
 */
export function createCheckpointSaver(): MemorySaver {
  return new MemorySaver();
}
