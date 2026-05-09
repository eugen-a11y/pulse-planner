import type {
  BaseRow,
  ListSinceOptions,
  LocalStore,
  SyncTable,
} from "./local-store.js";

type TableMap = Map<string, BaseRow>;

export class InMemoryStore implements LocalStore {
  private tables = new Map<SyncTable, TableMap>();

  private getTable(name: SyncTable): TableMap {
    let t = this.tables.get(name);
    if (!t) {
      t = new Map();
      this.tables.set(name, t);
    }
    return t;
  }

  async upsert<T extends BaseRow>(table: SyncTable, row: T): Promise<void> {
    this.getTable(table).set(row.id, structuredClone(row));
  }

  async findById<T extends BaseRow>(
    table: SyncTable,
    id: string,
  ): Promise<T | null> {
    const r = this.getTable(table).get(id);
    return (r ? (structuredClone(r) as T) : null);
  }

  async listSince<T extends BaseRow>(
    table: SyncTable,
    sinceIso: string | null,
    opts: ListSinceOptions = {},
  ): Promise<T[]> {
    const out: T[] = [];
    for (const r of this.getTable(table).values()) {
      if (opts.userId && r.userId !== opts.userId) continue;
      if (!opts.includeDeleted && r.deletedAt !== null) continue;
      if (sinceIso !== null && r.updatedAt <= sinceIso) continue;
      out.push(structuredClone(r) as T);
    }
    out.sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : 1));
    return out;
  }

  async softDelete(table: SyncTable, id: string, atIso: string): Promise<void> {
    const r = this.getTable(table).get(id);
    if (!r) return;
    r.deletedAt = atIso;
    r.updatedAt = atIso;
  }

  async transaction<R>(fn: (tx: LocalStore) => Promise<R>): Promise<R> {
    const snapshot = new Map<SyncTable, TableMap>();
    for (const [name, tbl] of this.tables) {
      snapshot.set(name, new Map(tbl));
    }
    try {
      return await fn(this);
    } catch (e) {
      this.tables = snapshot;
      throw e;
    }
  }
}
