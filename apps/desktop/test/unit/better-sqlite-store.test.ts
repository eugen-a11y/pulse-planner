import { describe, expect, it, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BetterSqliteStore } from "../../src/main/store/better-sqlite-store.js";
import { SqliteSyncStateRepo } from "../../src/main/store/sqlite-sync-state-repo.js";
import { makeProject, makeTask } from "@pulse/core";

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  const sql = readFileSync(
    join(__dirname, "..", "..", "src", "main", "store", "migrations", "001_init.sql"),
    "utf8",
  );
  db.exec(sql);
  return db;
}

describe("BetterSqliteStore", () => {
  let db: Database.Database;
  let store: BetterSqliteStore;
  beforeEach(() => {
    db = freshDb();
    store = new BetterSqliteStore(db);
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
});

describe("SqliteSyncStateRepo", () => {
  let db: Database.Database;
  let repo: SqliteSyncStateRepo;
  beforeEach(() => {
    db = freshDb();
    repo = new SqliteSyncStateRepo(db);
  });

  it("getCursor null when not set", async () => {
    expect(await repo.getCursor("tasks")).toBeNull();
  });

  it("setCursor then getCursor", async () => {
    await repo.setCursor("tasks", "2026-05-09T10:00:00.000Z");
    expect(await repo.getCursor("tasks")).toBe("2026-05-09T10:00:00.000Z");
  });

  it("setCursor overwrites", async () => {
    await repo.setCursor("tasks", "2026-05-09T10:00:00.000Z");
    await repo.setCursor("tasks", "2026-05-09T11:00:00.000Z");
    expect(await repo.getCursor("tasks")).toBe("2026-05-09T11:00:00.000Z");
  });
});
