/**
 * Drizzle DB client (better-sqlite3) with lazy initialization.
 *
 * Module evaluation must NOT open the SQLite file because Vercel's
 * "collect page data" build step imports server modules without a
 * `data/db/` directory present. We expose `db` as a Proxy that
 * triggers the real connection on first property access, and create
 * the parent directory if it doesn't exist.
 *
 * Note on deployment: better-sqlite3 needs a persistent disk.
 * Vercel serverless has read-only fs at runtime, so this works for
 * BUILD but writes will fail at request time. For production deploys
 * use Fly.io / Railway / Render (persistent volumes) or migrate to
 * Turso (libSQL) — see TODO at the bottom.
 */
import * as schema from "./schema";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

type AppDb = BetterSQLite3Database<typeof schema>;

let _db: AppDb | null = null;

function buildDb(): AppDb {
  // Required dynamically so the build's "collect page data" step
  // doesn't pull the native module in before .next/ exists.
  const {
    drizzle,
  } = require("drizzle-orm/better-sqlite3") as typeof import("drizzle-orm/better-sqlite3");
  const Database = require("better-sqlite3");
  const { dirname } = require("path") as typeof import("path");
  const { mkdirSync, existsSync } = require("fs") as typeof import("fs");

  const path =
    process.env.METAGROSS_SQLITE_PATH ?? "./data/db/metagross.db";
  // Auto-create the parent dir so a fresh deploy / clone with no
  // data/ folder doesn't crash on first DB access. On a read-only
  // filesystem this throws — we let better-sqlite3 surface a
  // clearer error than silently swallowing here.
  const dir = dirname(path);
  if (dir && !existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // ignore — better-sqlite3 will fail with a more useful message
    }
  }
  return drizzle(new Database(path), { schema });
}

/**
 * Proxy that triggers the real connection on first property access.
 * Drizzle's surface area is wide (select/insert/update/delete/from
 * ...), so a Proxy is cleaner than re-exporting every method.
 */
export const db: AppDb = new Proxy({} as AppDb, {
  get(_target, prop) {
    if (!_db) _db = buildDb();
    const value = (_db as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(_db);
    }
    return value;
  },
}) as AppDb;

// TODO(turso): when ready, swap to drizzle-orm/libsql + @libsql/client
// for serverless-compatible HTTP access. Requires async-ifying every
// .get()/.all()/.run() call site (~25 query files).
