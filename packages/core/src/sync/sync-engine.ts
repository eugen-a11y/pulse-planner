import type { SupabaseClient } from "@supabase/supabase-js";
import { Outbox, type OutboxEntry } from "./outbox.js";
import type { LocalStore, SyncTable } from "../store/local-store.js";
import { collectOutstandingFields, mergeRemoteWithOutbox } from "./conflict.js";

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

  subscribeRealtime(onChange: () => void): () => void {
    const channels = TABLES.map((t) => {
      const ch = (this.deps.supabase.channel(`pulse:${t}`) as any)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: t, filter: `user_id=eq.${this.deps.userId}` },
          () => onChange(),
        );
      ch.subscribe();
      return ch;
    });
    return () => {
      for (const ch of channels) {
        try { (ch as any).unsubscribe?.(); } catch { /* ignore */ }
      }
    };
  }

  async pull(sinceIso: string | null): Promise<string> {
    let maxSeen = sinceIso;
    const cursor = sinceIso ?? "1970-01-01T00:00:00.000Z";
    const outboxEntries = await this.deps.outbox.peekAll();

    for (const t of TABLES) {
      const { data, error } = await this.deps.supabase
        .from(t)
        .select("*")
        .gt("updated_at", cursor)
        .eq("user_id", this.deps.userId)
        .order("updated_at", { ascending: true });
      if (error) throw new Error(`pull ${t}: ${error.message}`);
      const rows = (data ?? []) as Record<string, unknown>[];
      for (const row of rows) {
        const camel = snakeToCamelRow(row);
        const local = await this.deps.store.findById<any>(t, camel.id as string);
        const outstanding = collectOutstandingFields(outboxEntries, t, camel.id as string);
        const merged = local && outstanding.length
          ? mergeRemoteWithOutbox(local, camel as any, outstanding)
          : camel;
        await this.deps.store.upsert(t, merged as any);
        if (!maxSeen || (camel.updatedAt as string) > maxSeen) {
          maxSeen = camel.updatedAt as string;
        }
      }
    }
    return maxSeen ?? (sinceIso ?? "1970-01-01T00:00:00.000Z");
  }
}

export const SYNCED_TABLES = TABLES;

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function snakeToCamelRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[snakeToCamel(k)] = v;
  }
  return out;
}
