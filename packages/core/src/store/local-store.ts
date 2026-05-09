export type SyncTable =
  | "projects"
  | "tasks"
  | "tags"
  | "task_tags"
  | "attachments"
  | "time_entries"
  | "comments"
  | "notes";

export interface BaseRow {
  id: string;
  userId: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ListSinceOptions {
  userId?: string;
  includeDeleted?: boolean;
}

export interface LocalStore {
  upsert<T extends BaseRow>(table: SyncTable, row: T): Promise<void>;
  findById<T extends BaseRow>(table: SyncTable, id: string): Promise<T | null>;
  listSince<T extends BaseRow>(
    table: SyncTable,
    sinceIso: string | null,
    opts?: ListSinceOptions,
  ): Promise<T[]>;
  softDelete(table: SyncTable, id: string, atIso: string): Promise<void>;
  transaction<R>(fn: (tx: LocalStore) => Promise<R>): Promise<R>;
}
