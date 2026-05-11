import type { SQLiteDatabase } from "expo-sqlite";
import type {
  BaseRow,
  ListSinceOptions,
  LocalStore,
  SyncTable,
} from "@pulse/core";
import {
  ALL_DDL,
  fromSqliteRow,
  toSqliteRow,
} from "@pulse/core";

const ALLOWED_TABLES: readonly SyncTable[] = [
  "projects",
  "tasks",
  "tags",
  "task_tags",
  "attachments",
  "time_entries",
  "comments",
  "notes",
];

function assertAllowed(t: SyncTable): void {
  if (!ALLOWED_TABLES.includes(t)) {
    throw new Error(`unknown sync table: ${t}`);
  }
}

/**
 * Factory: bootstraps the schema, then returns an ExpoSqliteStore.
 *
 * PRAGMA handling: passes ALL_DDL verbatim to execAsync (option a).
 * Both `PRAGMA journal_mode = WAL` and `PRAGMA foreign_keys = ON` are valid
 * SQL and work through expo-sqlite's execAsync on iOS; the underlying SQLite
 * engine processes PRAGMAs before DDL. In the test mock they run fine via
 * better-sqlite3's db.exec().
 */
export async function openExpoSqliteStore(db: SQLiteDatabase): Promise<ExpoSqliteStore> {
  await db.execAsync(ALL_DDL);
  return new ExpoSqliteStore(db);
}

export class ExpoSqliteStore implements LocalStore {
  constructor(private readonly db: SQLiteDatabase) {}

  async upsert<T extends BaseRow>(table: SyncTable, row: T): Promise<void> {
    assertAllowed(table);
    const r = toSqliteRow(table, row as unknown as Record<string, unknown>);
    const cols = Object.keys(r);
    const placeholders = cols.map(() => "?").join(", ");
    // task_tags is the only table with a composite PK and no `id` column.
    const conflictCols = table === "task_tags" ? ["task_id", "tag_id"] : ["id"];
    const updates = cols
      .filter((c) => !conflictCols.includes(c))
      .map((c) => `${c} = excluded.${c}`)
      .join(", ");
    const conflictSql =
      `ON CONFLICT(${conflictCols.join(", ")}) ` +
      (updates ? `DO UPDATE SET ${updates}` : "DO NOTHING");
    const sql =
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders}) ` + conflictSql;
    await this.db.runAsync(sql, ...cols.map((c) => r[c] as never));
  }

  async findById<T extends BaseRow>(table: SyncTable, id: string): Promise<T | null> {
    assertAllowed(table);
    const row = await this.db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE id = ?`,
      id,
    );
    return row ? (fromSqliteRow(table, row) as T) : null;
  }

  async listSince<T extends BaseRow>(
    table: SyncTable,
    sinceIso: string | null,
    opts: ListSinceOptions = {},
  ): Promise<T[]> {
    assertAllowed(table);
    const where: string[] = [];
    const args: unknown[] = [];
    if (opts.userId !== undefined) {
      where.push("user_id = ?");
      args.push(opts.userId);
    }
    // task_tags has no updated_at or deleted_at columns — skip those clauses.
    const hasUpdatedAt = table !== "task_tags";
    const hasDeletedAt = table !== "task_tags";
    if (sinceIso !== null && hasUpdatedAt) {
      where.push("updated_at > ?");
      args.push(sinceIso);
    }
    if (!opts.includeDeleted && hasDeletedAt) {
      where.push("deleted_at IS NULL");
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const sortCol = hasUpdatedAt ? "updated_at" : "created_at";
    const sql = `SELECT * FROM ${table} ${whereSql} ORDER BY ${sortCol} ASC`;
    const rows = await this.db.getAllAsync<Record<string, unknown>>(sql, ...args);
    return rows.map((r) => fromSqliteRow(table, r) as T);
  }

  async softDelete(table: SyncTable, id: string, atIso: string): Promise<void> {
    assertAllowed(table);
    await this.db.runAsync(
      `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      atIso,
      atIso,
      id,
    );
  }

  async transaction<R>(fn: (tx: LocalStore) => Promise<R>): Promise<R> {
    let result!: R;
    // withTransactionAsync rolls back automatically if the callback throws —
    // that is expo-sqlite's documented contract (and our mock mirrors it).
    await this.db.withTransactionAsync(async () => {
      result = await fn(this);
    });
    return result;
  }
}
