/**
 * libSQL-backed LangGraph checkpoint saver.
 *
 * A direct port of @langchain/langgraph-checkpoint-sqlite's SqliteSaver
 * with two key changes:
 *   1. Async @libsql/client instead of sync better-sqlite3 — works on
 *      Vercel's read-only serverless filesystem against Turso.
 *   2. Same conn-string contract as our main DB: file:./path for local
 *      dev, libsql://... for Turso. Reuses TURSO_DATABASE_URL and
 *      TURSO_AUTH_TOKEN so we don't need a second set of env vars.
 *
 * Schema mirrors SqliteSaver exactly so existing checkpoint dumps from
 * the better-sqlite3 file can be imported via `sqlite3 dump | libsql
 * shell` without translation.
 */
import {
  BaseCheckpointSaver,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointTuple,
  type PendingWrite,
  type SerializerProtocol,
  copyCheckpoint,
  maxChannelVersion,
  TASKS,
} from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";
import { createClient, type Client } from "@libsql/client";

const VALID_METADATA_KEYS = ["source", "step", "parents"] as const;

interface CheckpointRow {
  thread_id: string;
  checkpoint_ns: string;
  checkpoint_id: string;
  parent_checkpoint_id: string | null;
  type: string | null;
  checkpoint: Uint8Array;
  metadata: Uint8Array;
  pending_writes: string;
  pending_sends: string;
}

function buildSelectSql(byCheckpointId: boolean): string {
  return `
  SELECT
    thread_id,
    checkpoint_ns,
    checkpoint_id,
    parent_checkpoint_id,
    type,
    checkpoint,
    metadata,
    (
      SELECT
        json_group_array(
          json_object(
            'task_id', pw.task_id,
            'channel', pw.channel,
            'type', pw.type,
            'value', CAST(pw.value AS TEXT)
          )
        )
      FROM writes as pw
      WHERE pw.thread_id = checkpoints.thread_id
        AND pw.checkpoint_ns = checkpoints.checkpoint_ns
        AND pw.checkpoint_id = checkpoints.checkpoint_id
    ) as pending_writes,
    (
      SELECT
        json_group_array(
          json_object(
            'type', ps.type,
            'value', CAST(ps.value AS TEXT)
          )
        )
      FROM writes as ps
      WHERE ps.thread_id = checkpoints.thread_id
        AND ps.checkpoint_ns = checkpoints.checkpoint_ns
        AND ps.checkpoint_id = checkpoints.parent_checkpoint_id
        AND ps.channel = '${TASKS}'
      ORDER BY ps.idx
    ) as pending_sends
  FROM checkpoints
  WHERE thread_id = ? AND checkpoint_ns = ? ${byCheckpointId ? "AND checkpoint_id = ?" : "ORDER BY checkpoint_id DESC LIMIT 1"}`;
}

function asUint8(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (typeof v === "string") return new TextEncoder().encode(v);
  if (v && typeof v === "object" && "buffer" in (v as { buffer?: unknown })) {
    const inner = (v as { buffer: ArrayBufferLike }).buffer;
    return new Uint8Array(inner);
  }
  return new Uint8Array(0);
}

export class LibsqlCheckpointSaver extends BaseCheckpointSaver {
  client: Client;
  protected isSetup: boolean;

  constructor(client: Client, serde?: SerializerProtocol) {
    super(serde);
    this.client = client;
    this.isSetup = false;
  }

  static fromConnString(
    url: string,
    authToken?: string,
  ): LibsqlCheckpointSaver {
    return new LibsqlCheckpointSaver(createClient({ url, authToken }));
  }

  protected async setup(): Promise<void> {
    if (this.isSetup) return;
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS checkpoints (
        thread_id TEXT NOT NULL,
        checkpoint_ns TEXT NOT NULL DEFAULT '',
        checkpoint_id TEXT NOT NULL,
        parent_checkpoint_id TEXT,
        type TEXT,
        checkpoint BLOB,
        metadata BLOB,
        PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
      )
    `);
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS writes (
        thread_id TEXT NOT NULL,
        checkpoint_ns TEXT NOT NULL DEFAULT '',
        checkpoint_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        idx INTEGER NOT NULL,
        channel TEXT NOT NULL,
        type TEXT,
        value BLOB,
        PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
      )
    `);
    this.isSetup = true;
  }

  async getTuple(
    config: RunnableConfig,
  ): Promise<CheckpointTuple | undefined> {
    await this.setup();
    const {
      thread_id,
      checkpoint_ns = "",
      checkpoint_id,
    } = (config.configurable ?? {}) as {
      thread_id?: string;
      checkpoint_ns?: string;
      checkpoint_id?: string;
    };
    if (!thread_id) return undefined;
    const args: (string | number)[] = [thread_id, checkpoint_ns];
    if (checkpoint_id) args.push(checkpoint_id);
    const result = await this.client.execute({
      sql: buildSelectSql(!!checkpoint_id),
      args,
    });
    if (result.rows.length === 0) return undefined;
    const row = result.rows[0] as unknown as CheckpointRow;
    let finalConfig: RunnableConfig = config;
    if (!checkpoint_id) {
      finalConfig = {
        configurable: {
          thread_id: row.thread_id,
          checkpoint_ns,
          checkpoint_id: row.checkpoint_id,
        },
      };
    }
    const pendingWrites = await Promise.all(
      (JSON.parse(row.pending_writes) as Array<{
        task_id: string;
        channel: string;
        type?: string;
        value?: string;
      }>).map(async (write) => {
        return [
          write.task_id,
          write.channel,
          await this.serde.loadsTyped(write.type ?? "json", write.value ?? ""),
        ] as [string, string, unknown];
      }),
    );
    const checkpoint = (await this.serde.loadsTyped(
      row.type ?? "json",
      asUint8(row.checkpoint),
    )) as Checkpoint;
    if ((checkpoint.v ?? 0) < 4 && row.parent_checkpoint_id != null) {
      await this.migratePendingSends(
        checkpoint,
        row.thread_id,
        row.parent_checkpoint_id,
      );
    }
    return {
      checkpoint,
      config: finalConfig,
      metadata: (await this.serde.loadsTyped(
        row.type ?? "json",
        asUint8(row.metadata),
      )) as CheckpointMetadata,
      parentConfig: row.parent_checkpoint_id
        ? {
            configurable: {
              thread_id: row.thread_id,
              checkpoint_ns,
              checkpoint_id: row.parent_checkpoint_id,
            },
          }
        : undefined,
      pendingWrites,
    };
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions,
  ): AsyncGenerator<CheckpointTuple> {
    await this.setup();
    const { limit, before, filter } = options ?? {};
    const thread_id = config.configurable?.thread_id as string | undefined;
    const checkpoint_ns = config.configurable?.checkpoint_ns as
      | string
      | undefined;
    let sql = `
      SELECT
        thread_id,
        checkpoint_ns,
        checkpoint_id,
        parent_checkpoint_id,
        type,
        checkpoint,
        metadata,
        (
          SELECT
            json_group_array(
              json_object(
                'task_id', pw.task_id,
                'channel', pw.channel,
                'type', pw.type,
                'value', CAST(pw.value AS TEXT)
              )
            )
          FROM writes as pw
          WHERE pw.thread_id = checkpoints.thread_id
            AND pw.checkpoint_ns = checkpoints.checkpoint_ns
            AND pw.checkpoint_id = checkpoints.checkpoint_id
        ) as pending_writes,
        (
          SELECT
            json_group_array(
              json_object(
                'type', ps.type,
                'value', CAST(ps.value AS TEXT)
              )
            )
          FROM writes as ps
          WHERE ps.thread_id = checkpoints.thread_id
            AND ps.checkpoint_ns = checkpoints.checkpoint_ns
            AND ps.checkpoint_id = checkpoints.parent_checkpoint_id
            AND ps.channel = '${TASKS}'
          ORDER BY ps.idx
        ) as pending_sends
      FROM checkpoints\n`;
    const whereClause: string[] = [];
    if (thread_id) whereClause.push("thread_id = ?");
    if (checkpoint_ns !== undefined && checkpoint_ns !== null) {
      whereClause.push("checkpoint_ns = ?");
    }
    if (before?.configurable?.checkpoint_id !== undefined) {
      whereClause.push("checkpoint_id < ?");
    }
    const sanitizedFilter = Object.fromEntries(
      Object.entries(filter ?? {}).filter(
        ([key, value]) =>
          value !== undefined &&
          (VALID_METADATA_KEYS as readonly string[]).includes(key),
      ),
    );
    whereClause.push(
      ...Object.entries(sanitizedFilter).map(
        ([key]) => `jsonb(CAST(metadata AS TEXT))->'$.${key}' = ?`,
      ),
    );
    if (whereClause.length > 0) sql += `WHERE\n  ${whereClause.join(" AND\n  ")}\n`;
    sql += "\nORDER BY checkpoint_id DESC";
    if (limit) sql += ` LIMIT ${parseInt(String(limit), 10)}`;
    const args = [
      thread_id,
      checkpoint_ns,
      before?.configurable?.checkpoint_id,
      ...Object.values(sanitizedFilter).map((v) => JSON.stringify(v)),
    ].filter((v) => v !== undefined && v !== null) as (string | number)[];
    const result = await this.client.execute({ sql, args });
    for (const r of result.rows) {
      const row = r as unknown as CheckpointRow;
      const pendingWrites = await Promise.all(
        (JSON.parse(row.pending_writes) as Array<{
          task_id: string;
          channel: string;
          type?: string;
          value?: string;
        }>).map(async (write) => {
          return [
            write.task_id,
            write.channel,
            await this.serde.loadsTyped(
              write.type ?? "json",
              write.value ?? "",
            ),
          ] as [string, string, unknown];
        }),
      );
      const checkpoint = (await this.serde.loadsTyped(
        row.type ?? "json",
        asUint8(row.checkpoint),
      )) as Checkpoint;
      if ((checkpoint.v ?? 0) < 4 && row.parent_checkpoint_id != null) {
        await this.migratePendingSends(
          checkpoint,
          row.thread_id,
          row.parent_checkpoint_id,
        );
      }
      yield {
        config: {
          configurable: {
            thread_id: row.thread_id,
            checkpoint_ns: row.checkpoint_ns,
            checkpoint_id: row.checkpoint_id,
          },
        },
        checkpoint,
        metadata: (await this.serde.loadsTyped(
          row.type ?? "json",
          asUint8(row.metadata),
        )) as CheckpointMetadata,
        parentConfig: row.parent_checkpoint_id
          ? {
              configurable: {
                thread_id: row.thread_id,
                checkpoint_ns: row.checkpoint_ns,
                checkpoint_id: row.parent_checkpoint_id,
              },
            }
          : undefined,
        pendingWrites,
      };
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
  ): Promise<RunnableConfig> {
    await this.setup();
    if (!config.configurable) throw new Error("Empty configuration supplied.");
    const thread_id = config.configurable.thread_id as string | undefined;
    const checkpoint_ns =
      (config.configurable.checkpoint_ns as string | undefined) ?? "";
    const parent_checkpoint_id = config.configurable.checkpoint_id as
      | string
      | undefined;
    if (!thread_id) {
      throw new Error(
        `Missing "thread_id" field in passed "config.configurable".`,
      );
    }
    const prepared = copyCheckpoint(checkpoint);
    const [
      [type1, serializedCheckpoint],
      [type2, serializedMetadata],
    ] = await Promise.all([
      this.serde.dumpsTyped(prepared),
      this.serde.dumpsTyped(metadata),
    ]);
    if (type1 !== type2) {
      throw new Error(
        "Failed to serialize checkpoint and metadata to the same type.",
      );
    }
    await this.client.execute({
      sql: `INSERT OR REPLACE INTO checkpoints (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        thread_id,
        checkpoint_ns,
        checkpoint.id,
        parent_checkpoint_id ?? null,
        type1,
        serializedCheckpoint,
        serializedMetadata,
      ],
    });
    return {
      configurable: {
        thread_id,
        checkpoint_ns,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
  ): Promise<void> {
    await this.setup();
    if (!config.configurable) throw new Error("Empty configuration supplied.");
    const thread_id = config.configurable.thread_id as string | undefined;
    const checkpoint_ns =
      (config.configurable.checkpoint_ns as string | undefined) ?? "";
    const checkpoint_id = config.configurable.checkpoint_id as
      | string
      | undefined;
    if (!thread_id) {
      throw new Error("Missing thread_id field in config.configurable.");
    }
    if (!checkpoint_id) {
      throw new Error("Missing checkpoint_id field in config.configurable.");
    }
    const stmts = await Promise.all(
      writes.map(async (write, idx) => {
        const [type, serialized] = await this.serde.dumpsTyped(write[1]);
        return {
          sql: `INSERT OR REPLACE INTO writes (thread_id, checkpoint_ns, checkpoint_id, task_id, idx, channel, type, value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            thread_id,
            checkpoint_ns,
            checkpoint_id,
            taskId,
            idx,
            write[0],
            type,
            serialized,
          ] as (string | number | Uint8Array)[],
        };
      }),
    );
    if (stmts.length > 0) {
      await this.client.batch(stmts, "write");
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.setup();
    await this.client.batch(
      [
        { sql: `DELETE FROM checkpoints WHERE thread_id = ?`, args: [threadId] },
        { sql: `DELETE FROM writes WHERE thread_id = ?`, args: [threadId] },
      ],
      "write",
    );
  }

  protected async migratePendingSends(
    checkpoint: Checkpoint,
    threadId: string,
    parentCheckpointId: string,
  ): Promise<void> {
    const result = await this.client.execute({
      sql: `
        SELECT
          checkpoint_id,
          json_group_array(
            json_object(
              'type', ps.type,
              'value', CAST(ps.value AS TEXT)
            )
          ) as pending_sends
        FROM writes as ps
        WHERE ps.thread_id = ?
          AND ps.checkpoint_id = ?
          AND ps.channel = '${TASKS}'
        ORDER BY ps.idx
      `,
      args: [threadId, parentCheckpointId],
    });
    const row = result.rows[0] as unknown as { pending_sends: string } | undefined;
    if (!row) return;
    const mutable = checkpoint as Checkpoint;
    mutable.channel_values ??= {};
    mutable.channel_values[TASKS] = await Promise.all(
      (JSON.parse(row.pending_sends) as Array<{ type: string; value: string }>).map(
        ({ type, value }) => this.serde.loadsTyped(type, value),
      ),
    );
    mutable.channel_versions[TASKS] =
      Object.keys(checkpoint.channel_versions).length > 0
        ? maxChannelVersion(...Object.values(checkpoint.channel_versions))
        : this.getNextVersion(undefined);
  }
}
