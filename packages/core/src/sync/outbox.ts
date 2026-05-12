import type { SyncTable } from "../store/local-store.js";
import { nowIso } from "../domain/timestamps.js";

export interface OutboxEntry {
  queuedAt: string;
  entityTable: SyncTable;
  entityId: string;
  op: "insert" | "update" | "delete";
  changedFields: Record<string, unknown>;
  clientTs: string;
  attempts: number;
  lastError?: string;
}

export class Outbox {
  private q: OutboxEntry[] = [];

  async enqueue(
    e: Omit<OutboxEntry, "queuedAt" | "attempts">,
  ): Promise<void> {
    this.q.push({ ...e, queuedAt: nowIso(), attempts: 0 });
  }

  async peekAll(): Promise<OutboxEntry[]> {
    return [...this.q];
  }

  async ack(queuedAt: string): Promise<void> {
    this.q = this.q.filter((e) => e.queuedAt !== queuedAt);
  }

  async nack(queuedAt: string, error: string): Promise<void> {
    const e = this.q.find((x) => x.queuedAt === queuedAt);
    if (!e) return;
    e.attempts += 1;
    e.lastError = error;
  }

  /**
   * Drop an entry from the queue without recording success. Used by the
   * mobile DLQ screen when the user chooses "Verwerfen" on a stuck entry.
   * Semantically identical to `ack` (both remove by queuedAt), but kept as a
   * distinct method so callers/intent are clear and so a future persistent
   * Outbox can record discard-vs-ack metrics separately.
   */
  async discard(queuedAt: string): Promise<void> {
    this.q = this.q.filter((e) => e.queuedAt !== queuedAt);
  }

  static backoffMs(attempts: number): number {
    if (attempts <= 0) return 0;
    return Math.min(2 ** (attempts - 1) * 1_000, 300_000);
  }
}
