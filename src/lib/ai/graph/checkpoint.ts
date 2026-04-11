import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';

const CHECKPOINT_DB_PATH = './data/db/metagross-agent-checkpoints.db';

/**
 * Create a SqliteSaver checkpoint store for LangGraph agent threads.
 * Uses a dedicated SQLite database separate from the main app DB.
 */
export function createCheckpointSaver(): SqliteSaver {
  return SqliteSaver.fromConnString(CHECKPOINT_DB_PATH);
}
