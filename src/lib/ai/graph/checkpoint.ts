import { LibsqlCheckpointSaver } from "./checkpoint-libsql";

/**
 * LangGraph thread checkpoint store, libSQL-backed.
 *
 * Same conn-string contract as the main DB: file:./… for local dev,
 * libsql://… for Turso. The saver creates its own `checkpoints` and
 * `writes` tables on first use, so no separate migration is needed.
 *
 * Threads persist across cold-starts and across redeploys — clicking
 * an old thread in /teams/new replays its full message history.
 */
export function createCheckpointSaver(): LibsqlCheckpointSaver {
  const url =
    process.env.TURSO_DATABASE_URL?.trim() ||
    `file:${process.env.METAGROSS_SQLITE_PATH ?? "./data/db/metagross.db"}`;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  return LibsqlCheckpointSaver.fromConnString(url, authToken);
}
