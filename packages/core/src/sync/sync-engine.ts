import type { SupabaseClient } from "@supabase/supabase-js";
import { Outbox, type OutboxEntry } from "./outbox.js";
import type { LocalStore, SyncTable } from "../store/local-store.js";

export interface SyncEngineDeps {
  supabase: SupabaseClient;
  outbox: Outbox;
  store: LocalStore;
  userId: string;
}

const TABLES: readonly SyncTable[] = [
  "projects", "tasks", "tags", "task_tags",
  "attachments", "time_entries", "comments", "notes",
];

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
}

function snakifyKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[camelToSnake(k)] = v;
  }
  return out;
}

export class SyncEngine {
  constructor(private readonly deps: SyncEngineDeps) {}

  async push(): Promise<void> {
    const entries = await this.deps.outbox.peekAll();
    for (const e of entries) {
      const ok = await this.pushOne(e);
      if (!ok) break;            // stop on first failure; retry later
    }
  }

  private async pushOne(e: OutboxEntry): Promise<boolean> {
    const { data, error } = await this.deps.supabase.rpc("sync_upsert", {
      p_table:     e.entityTable,
      p_id:        e.entityId,
      p_op:        e.op,
      p_changes:   snakifyKeys(e.changedFields),
      p_client_ts: e.clientTs,
    });
    if (error) {
      await this.deps.outbox.nack(e.queuedAt, error.message);
      return false;
    }
    void data;
    await this.deps.outbox.ack(e.queuedAt);
    return true;
  }
}

export const SYNCED_TABLES = TABLES;
