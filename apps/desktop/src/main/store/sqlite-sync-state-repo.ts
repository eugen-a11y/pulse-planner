import type Database from "better-sqlite3";
import type { SyncStateRepo, SyncTable } from "@pulse/core";

export class SqliteSyncStateRepo implements SyncStateRepo {
  constructor(private readonly db: Database.Database) {}

  async getCursor(table: SyncTable): Promise<string | null> {
    const row = this.db.prepare("SELECT last_pulled_at FROM sync_state WHERE table_name = ?")
      .get(table) as { last_pulled_at: string } | undefined;
    return row ? row.last_pulled_at : null;
  }

  async setCursor(table: SyncTable, iso: string): Promise<void> {
    this.db.prepare(
      "INSERT INTO sync_state (table_name, last_pulled_at) VALUES (?, ?) " +
      "ON CONFLICT(table_name) DO UPDATE SET last_pulled_at = excluded.last_pulled_at",
    ).run(table, iso);
  }
}
