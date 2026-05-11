import type { SQLiteDatabase } from "expo-sqlite";
import type { SyncStateRepo, SyncTable } from "@pulse/core";

export class ExpoSqliteSyncStateRepo implements SyncStateRepo {
  constructor(private readonly db: SQLiteDatabase) {}

  async getCursor(table: SyncTable): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ last_pulled_at: string }>(
      "SELECT last_pulled_at FROM sync_state WHERE table_name = ?",
      table,
    );
    return row ? row.last_pulled_at : null;
  }

  async setCursor(table: SyncTable, iso: string): Promise<void> {
    await this.db.runAsync(
      "INSERT INTO sync_state (table_name, last_pulled_at) VALUES (?, ?) " +
      "ON CONFLICT(table_name) DO UPDATE SET last_pulled_at = excluded.last_pulled_at",
      table,
      iso,
    );
  }
}
