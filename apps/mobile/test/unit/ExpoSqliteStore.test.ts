/**
 * ExpoSqliteStore tests (TDD).
 *
 * Approach A: expo-sqlite is mocked via test/__mocks__/expo-sqlite.ts which
 * delegates to a real better-sqlite3 in-memory instance. This validates all
 * SQL strings end-to-end without requiring native iOS SQLite.
 *
 * The jest.config.js moduleNameMapper redirects `expo-sqlite` to the mock file
 * so no jest.mock() call is needed here.
 */

import { describe, expect, it, beforeEach } from "@jest/globals";
import { openDatabaseAsync } from "expo-sqlite";
import { openExpoSqliteStore, ExpoSqliteStore } from "../../src/platform/ExpoSqliteStore";
import {
  makeProject,
  makeTask,
  makeTaskTag,
} from "@pulse/core";

async function freshStore(): Promise<ExpoSqliteStore> {
  const db = await openDatabaseAsync(":memory:");
  return openExpoSqliteStore(db as any);
}

describe("ExpoSqliteStore", () => {
  let store: ExpoSqliteStore;

  beforeEach(async () => {
    store = await freshStore();
  });

  it("upserts then findById returns the row", async () => {
    const p = makeProject({ userId: "u1", name: "P1" });
    await store.upsert("projects", p);
    const got = await store.findById<typeof p>("projects", p.id);
    expect(got?.id).toBe(p.id);
    expect(got?.name).toBe("P1");
    expect(got?.archived).toBe(false);
    expect(got?.deletedAt).toBeNull();
  });

  it("upsert is idempotent", async () => {
    const p = makeProject({ userId: "u1", name: "P1" });
    await store.upsert("projects", p);
    await store.upsert("projects", { ...p, name: "P1-renamed" });
    const got = await store.findById<typeof p>("projects", p.id);
    expect(got?.name).toBe("P1-renamed");
  });

  it("listSince filters by user_id and updated_at strict greater-than", async () => {
    const a = makeProject({ userId: "u1", name: "a" });
    a.updatedAt = "2026-05-01T00:00:00.000Z";
    const b = makeProject({ userId: "u1", name: "b" });
    b.updatedAt = "2026-05-09T00:00:00.000Z";
    const c = makeProject({ userId: "u2", name: "c" });
    c.updatedAt = "2026-05-09T00:00:00.000Z";
    await store.upsert("projects", a);
    await store.upsert("projects", b);
    await store.upsert("projects", c);
    const rows = await store.listSince("projects", "2026-05-05T00:00:00.000Z", { userId: "u1" });
    expect(rows.map((r) => (r as any).id)).toEqual([b.id]);
  });

  it("listSince with sinceIso null returns all non-deleted rows for user", async () => {
    const a = makeProject({ userId: "u1", name: "a" });
    const b = makeProject({ userId: "u1", name: "b" });
    await store.upsert("projects", a);
    await store.upsert("projects", b);
    await store.softDelete("projects", a.id, "2026-05-09T12:00:00.000Z");
    const rows = await store.listSince("projects", null, { userId: "u1" });
    expect(rows.map((r) => (r as any).id)).toEqual([b.id]);
  });

  it("softDelete sets deletedAt and bumps updatedAt", async () => {
    const t = makeTask({ userId: "u1", projectId: "p", title: "x" });
    await store.upsert("tasks", t);
    await store.softDelete("tasks", t.id, "2026-05-09T12:00:00.000Z");
    const got = await store.findById<typeof t>("tasks", t.id);
    expect(got?.deletedAt).toBe("2026-05-09T12:00:00.000Z");
    expect(got?.updatedAt).toBe("2026-05-09T12:00:00.000Z");
  });

  it("transaction rolls back on throw", async () => {
    const p = makeProject({ userId: "u1", name: "Original" });
    await store.upsert("projects", p);
    await expect(
      store.transaction(async (tx) => {
        await tx.upsert("projects", { ...p, name: "Changed" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const got = await store.findById<typeof p>("projects", p.id);
    expect(got?.name).toBe("Original");
  });

  it("transaction rolls back softDelete", async () => {
    const t = makeTask({ userId: "u1", projectId: "p", title: "x" });
    await store.upsert("tasks", t);
    await expect(
      store.transaction(async (tx) => {
        await tx.softDelete("tasks", t.id, "2026-05-09T12:00:00.000Z");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const got = await store.findById<typeof t>("tasks", t.id);
    expect(got?.deletedAt).toBeNull();
  });

  it("task_tags composite-PK upsert: insert then re-upsert same (task_id, tag_id) is idempotent", async () => {
    const tt = makeTaskTag({ userId: "u1", taskId: "task-1", tagId: "tag-1" });
    // First insert
    await store.upsert("task_tags", tt as any);
    // Re-upsert same composite PK — should not throw
    await expect(store.upsert("task_tags", tt as any)).resolves.toBeUndefined();
    // Confirm row exists
    const rows = await store.listSince<any>("task_tags", null, { userId: "u1", includeDeleted: true });
    expect(rows.length).toBe(1);
  });
});
