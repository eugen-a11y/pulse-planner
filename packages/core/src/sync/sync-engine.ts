import type { SupabaseClient } from "@supabase/supabase-js";
import { Outbox, type OutboxEntry } from "./outbox.js";
import type { LocalStore, SyncTable } from "../store/local-store.js";
import { collectOutstandingFields, mergeRemoteWithOutbox } from "./conflict.js";
import { snakifyKeys, snakeToCamelRow } from "./case-mapping.js";

export interface SyncEngineDeps {
  supabase: SupabaseClient;
  outbox: Outbox;
  store: LocalStore;
  userId: string;
  stateRepo?: import("./sync-state-repo.js").SyncStateRepo;
}

const TABLES: readonly SyncTable[] = [
  "projects", "tasks", "tags", "task_tags",
  "attachments", "time_entries", "comments", "notes",
];

/** Tables that have an updated_at column and participate in cursor-based pull. */
const CURSOR_TABLES: readonly SyncTable[] = [
  "projects", "tasks", "tags",
  "attachments", "time_entries", "comments", "notes",
];

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

  async pull(): Promise<string>;
  async pull(sinceIso: string | null): Promise<string>;
  async pull(sinceIso?: string | null): Promise<string> {
    const repo = this.deps.stateRepo;

    let maxSeen: string | null = null;
    const outboxEntries = await this.deps.outbox.peekAll();

    for (const t of CURSOR_TABLES) {
      const tableCursor = (sinceIso !== undefined)
        ? sinceIso
        : repo ? (await repo.getCursor(t)) : null;
      const sqlCursor = tableCursor ?? "1970-01-01T00:00:00.000Z";

      const { data, error } = await this.deps.supabase
        .from(t)
        .select("*")
        .gt("updated_at", sqlCursor)
        .eq("user_id", this.deps.userId)
        .order("updated_at", { ascending: true });
      if (error) throw new Error(`pull ${t}: ${error.message}`);

      const rows = (data ?? []) as Record<string, unknown>[];
      let tableMax: string | null = tableCursor;
      for (const row of rows) {
        const camel = snakeToCamelRow(row);
        const local = await this.deps.store.findById<any>(t, camel.id as string);
        const outstanding = collectOutstandingFields(outboxEntries, t, camel.id as string);
        const merged = local && outstanding.length
          ? mergeRemoteWithOutbox(local, camel, outstanding)
          : camel;
        await this.deps.store.upsert(t, merged as any);
        const ts = camel.updatedAt as string;
        if (!tableMax || ts > tableMax) tableMax = ts;
        if (!maxSeen || ts > maxSeen) maxSeen = ts;
      }
      if (repo && sinceIso === undefined && tableMax) {
        await repo.setCursor(t, tableMax);
      }
    }
    return maxSeen ?? (sinceIso ?? "1970-01-01T00:00:00.000Z");
  }
}

export const SYNCED_TABLES = TABLES;
