/**
 * Smoke test for the tasks store recurrence-spawn logic.
 *
 * Mirrors the behavior in `apps/desktop/src/main/ipc.ts` `tasks.complete` —
 * when completing a task with an RRULE, a child task should be spawned with
 * `recurrenceParentId` set to the original task's id (or its existing root).
 *
 * Uses the in-memory better-sqlite3-backed expo-sqlite mock (via the existing
 * jest moduleNameMapper) and stubs only what we need for the store: `db`,
 * `store`, `outbox`, and `userId` are real; everything sync-related is left
 * null since `complete` doesn't touch the engine.
 */

import { describe, expect, it, beforeEach, afterAll } from "@jest/globals";
import { openDatabaseAsync } from "expo-sqlite";
import { openExpoSqliteStore } from "../../src/platform/ExpoSqliteStore";
import { useTasks, bindDeps } from "../../src/stores/tasks";
import { makeTask, Outbox } from "@pulse/core";
import type { MobileDeps } from "../../src/wiring/deps";
import { clearReconcileDebounce } from "../../src/notifications";

async function buildFakeDeps(): Promise<MobileDeps> {
  const db = await openDatabaseAsync(":memory:");
  const store = await openExpoSqliteStore(db as any);
  const outbox = new Outbox();
  const deps: MobileDeps = {
    db: db as any,
    store,
    stateRepo: null as any,
    outbox,
    supabase: null as any,
    auth: null as any,
    engine: null,
    userId: "u1",
    setUserId(_uid: string) { /* not used */ },
  };
  return deps;
}

describe("tasks store · complete()", () => {
  beforeEach(() => {
    // Reset zustand state between cases. createStore exposes `setState` directly.
    useTasks.setState({
      byId: {}, todayIds: [], upcomingIds: [], inboxIds: [], byProject: {}, loaded: false,
    });
  });

  afterAll(() => {
    // The store schedules a debounced notification reconcile on every refresh.
    // Clear the pending timer so Jest's worker can exit cleanly.
    clearReconcileDebounce();
  });

  it("spawns a child task for an RRULE-bearing parent", async () => {
    const deps = await buildFakeDeps();
    bindDeps(deps);

    const parent = makeTask({
      userId: "u1",
      projectId: null,
      title: "Daily standup",
      dueDate: "2026-05-12T09:00:00.000Z",
      recurrenceRule: "FREQ=DAILY",
    });
    await deps.store.upsert("tasks", parent);

    await useTasks.getState().complete(parent.id);

    const all = await deps.store.listSince("tasks", null, { userId: "u1" });
    // 1 parent + 1 spawned child.
    expect(all.length).toBe(2);
    const child = (all as any[]).find((t) => t.id !== parent.id);
    expect(child).toBeDefined();
    expect(child.recurrenceParentId).toBe(parent.id);
    expect(child.recurrenceRule).toBe("FREQ=DAILY");
    expect(child.status).toBe("todo");
    // Child due-date should be ~1 day after parent.
    expect(new Date(child.dueDate).getTime())
      .toBeGreaterThan(new Date(parent.dueDate!).getTime());
  });

  it("does not spawn a child for a non-recurring task", async () => {
    const deps = await buildFakeDeps();
    bindDeps(deps);

    const t = makeTask({
      userId: "u1",
      projectId: null,
      title: "One-off",
      dueDate: "2026-05-12T09:00:00.000Z",
    });
    await deps.store.upsert("tasks", t);

    await useTasks.getState().complete(t.id);

    const all = await deps.store.listSince("tasks", null, { userId: "u1" });
    expect(all.length).toBe(1);
    expect((all[0] as any).status).toBe("done");
  });
});
