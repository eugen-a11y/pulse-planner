import { makeTimeEntry, nowIso, stopTimer, type Outbox, type TimeEntry } from "@pulse/core";
import type { BetterSqliteStore } from "./store/better-sqlite-store.js";

export interface TimerDeps {
  store: BetterSqliteStore;
  outbox: Outbox;
  userId: string;
}

export class TimerService {
  private active: TimeEntry | null = null;

  constructor(private readonly deps: TimerDeps) {}

  /** Restore a still-running entry from the store. Call once at app start. */
  async init(): Promise<void> {
    const all = await this.deps.store.listSince<TimeEntry>("time_entries", null, { userId: this.deps.userId });
    const running = all.find((e) => e.endedAt === null);
    this.active = running ?? null;
  }

  current(): { taskId: string; startedAt: string } | null {
    if (!this.active) return null;
    return { taskId: this.active.taskId, startedAt: this.active.startedAt };
  }

  async start(taskId: string): Promise<TimeEntry> {
    if (this.active) await this.stop();
    const entry = makeTimeEntry({ userId: this.deps.userId, taskId, startedAt: nowIso() });
    await this.deps.store.upsert("time_entries", entry);
    await this.deps.outbox.enqueue({
      entityTable: "time_entries", entityId: entry.id, op: "insert",
      changedFields: serialize(entry), clientTs: entry.updatedAt,
    });
    this.active = entry;
    return entry;
  }

  async stop(): Promise<TimeEntry | null> {
    if (!this.active) return null;
    const stopped = stopTimer(this.active, nowIso());
    await this.deps.store.upsert("time_entries", stopped);
    await this.deps.outbox.enqueue({
      entityTable: "time_entries", entityId: stopped.id, op: "update",
      changedFields: { endedAt: stopped.endedAt, durationSeconds: stopped.durationSeconds, updatedAt: stopped.updatedAt },
      clientTs: stopped.updatedAt,
    });
    this.active = null;
    return stopped;
  }
}

function serialize(e: TimeEntry): Record<string, unknown> {
  return {
    id: e.id, taskId: e.taskId, startedAt: e.startedAt, endedAt: e.endedAt,
    durationSeconds: e.durationSeconds, createdAt: e.createdAt, updatedAt: e.updatedAt, deletedAt: e.deletedAt,
  };
}
