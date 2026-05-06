/**
 * Drizzle DB client over libSQL.
 *
 * One driver, two URL shapes:
 *   - Local dev:  file:./data/db/metagross.db   (libSQL local mode)
 *   - Production: libsql://<host>.turso.io      (Turso, async over HTTP)
 *
 * Pick the URL via TURSO_DATABASE_URL. If unset we default to the
 * local file path so existing dev workflows keep working without
 * any env changes.
 *
 * All queries are async (`.get()`, `.all()`, `.run()` return
 * Promises) — that's the libSQL contract. Every call site in this
 * project awaits accordingly.
 */
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import { dirname } from "path";
import { mkdirSync, existsSync } from "fs";

type AppDb = ReturnType<typeof buildDb>;

let _db: AppDb | null = null;

function resolveUrl(): string {
  const raw = process.env.TURSO_DATABASE_URL ?? "";
  if (raw.trim().length > 0) return raw.trim();

  // Default — local dev. `file:` prefix puts libSQL in embedded mode
  // with the same file better-sqlite3 used to use, so existing data
  // / migrations stay valid.
  const path = process.env.METAGROSS_SQLITE_PATH ?? "./data/db/metagross.db";
  return `file:${path}`;
}

function ensureLocalDir(url: string): void {
  if (!url.startsWith("file:")) return;
  const path = url.slice("file:".length);
  const dir = dirname(path);
  if (!dir || existsSync(dir)) return;
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // Read-only filesystem (Vercel serverless) — let libSQL surface
    // a clearer error than swallowing here.
  }
}

function buildDb() {
  const url = resolveUrl();
  ensureLocalDir(url);
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

/**
 * Lazy proxy. Module evaluation must NOT open the connection because
 * Vercel's "collect page data" build step imports server modules
 * before any TURSO_DATABASE_URL env is available.
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
