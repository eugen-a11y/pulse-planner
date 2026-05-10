import type Database from "better-sqlite3";
import type {
  BaseRow,
  ListSinceOptions,
  LocalStore,
  SyncTable,
} from "@pulse/core";
import { fromSqliteRow, toSqliteRow } from "./case-mapping-row.js";

const ALLOWED_TABLES: readonly SyncTable[] = [
  "projects", "tasks", "tags", "task_tags",
  "attachments", "time_entries", "comments", "notes",
];

function assertAllowed(t: SyncTable): void {
  if (!ALLOWED_TABLES.includes(t)) {
    throw new Error(`unknown sync table: ${t}`);
  }
}

export class BetterSqliteStore implements LocalStore {
  constructor(private readonly db: Database.Database) {}

  async upsert<T extends BaseRow>(table: SyncTable, row: T): Promise<void> {
    assertAllowed(table);
    const r = toSqliteRow(table, row as unknown as Record<string, unknown>);
    const cols = Object.keys(r);
    const placeholders = cols.map(() => "?").join(", ");
    const updates = cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ");
    const sql =
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders}) ` +
      `ON CONFLICT(id) DO UPDATE SET ${updates}`;
    this.db.prepare(sql).run(cols.map((c) => r[c] as never));
  }

  async findById<T extends BaseRow>(table: SyncTable, id: string): Promise<T | null> {
    assertAllowed(table);
    const row = this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
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
    if (sinceIso !== null) {
      where.push("updated_at > ?");
      args.push(sinceIso);
    }
    if (!opts.includeDeleted) {
      where.push("deleted_at IS NULL");
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const sql = `SELECT * FROM ${table} ${whereSql} ORDER BY updated_at ASC`;
    const rows = this.db.prepare(sql).all(...args) as Record<string, unknown>[];
    return rows.map((r) => fromSqliteRow(table, r) as T);
  }

  async softDelete(table: SyncTable, id: string, atIso: string): Promise<void> {
    assertAllowed(table);
    this.db.prepare(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`)
      .run(atIso, atIso, id);
  }

  async transaction<R>(fn: (tx: LocalStore) => Promise<R>): Promise<R> {
    // better-sqlite3 transactions are sync. We wrap via savepoint + manual control
    // because LocalStore.transaction is async. SAVEPOINT lets us roll back on throw.
    const sp = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.db.prepare(`SAVEPOINT ${sp}`).run();
    try {
      const result = await fn(this);
      this.db.prepare(`RELEASE SAVEPOINT ${sp}`).run();
      return result;
    } catch (e) {
      this.db.prepare(`ROLLBACK TO SAVEPOINT ${sp}`).run();
      this.db.prepare(`RELEASE SAVEPOINT ${sp}`).run();
      throw e;
    }
  }
}
