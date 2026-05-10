import type { SyncTable } from "../store/local-store.js";

export interface SyncStateRepo {
  getCursor(table: SyncTable): Promise<string | null>;
  setCursor(table: SyncTable, iso: string): Promise<void>;
}

export class InMemorySyncStateRepo implements SyncStateRepo {
  private map = new Map<SyncTable, string>();
  async getCursor(table: SyncTable): Promise<string | null> {
    return this.map.get(table) ?? null;
  }
  async setCursor(table: SyncTable, iso: string): Promise<void> {
    this.map.set(table, iso);
  }
}
