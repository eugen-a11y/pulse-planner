import { describe, expect, it } from "vitest";
import { InMemoryStore } from "../../src/store/in-memory-store.js";
import { makeProject } from "../../src/domain/project.js";
import { makeTask } from "../../src/domain/task.js";

describe("InMemoryStore", () => {
  it("upserts and reads back rows by id", async () => {
    const store = new InMemoryStore();
    const p = makeProject({ userId: "u1", name: "P1" });
    await store.upsert("projects", p);
    expect(await store.findById("projects", p.id)).toEqual(p);
  });

  it("listSince returns rows updated after the cutoff", async () => {
    const store = new InMemoryStore();
    const a = makeProject({ userId: "u1", name: "a" });
    a.updatedAt = "2026-05-01T00:00:00.000Z";
    const b = makeProject({ userId: "u1", name: "b" });
    b.updatedAt = "2026-05-09T00:00:00.000Z";
    await store.upsert("projects", a);
    await store.upsert("projects", b);
    const rows = await store.listSince("projects", "2026-05-05T00:00:00.000Z");
    expect(rows.map((r) => r.id)).toEqual([b.id]);
  });

  it("listSince filters by user_id", async () => {
    const store = new InMemoryStore();
    const a = makeProject({ userId: "u1", name: "a" });
    const b = makeProject({ userId: "u2", name: "b" });
    await store.upsert("projects", a);
    await store.upsert("projects", b);
    const rows = await store.listSince("projects", null, { userId: "u1" });
    expect(rows.map((r) => r.id)).toEqual([a.id]);
  });

  it("delete sets deleted_at without removing the row", async () => {
    const store = new InMemoryStore();
    const t = makeTask({ userId: "u1", projectId: "p", title: "x" });
    await store.upsert("tasks", t);
    await store.softDelete("tasks", t.id, "2026-05-09T12:00:00.000Z");
    const found = await store.findById("tasks", t.id);
    expect(found?.deletedAt).toBe("2026-05-09T12:00:00.000Z");
  });

  it("transaction rolls back on throw", async () => {
    const store = new InMemoryStore();
    const a = makeProject({ userId: "u1", name: "a" });
    await store.upsert("projects", a);
    await expect(
      store.transaction(async (tx) => {
        await tx.upsert("projects", { ...a, name: "changed" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const after = await store.findById("projects", a.id);
    expect(after?.name).toBe("a");
  });

  it("transaction rolls back softDelete on throw", async () => {
    const store = new InMemoryStore();
    const t = makeTask({ userId: "u1", projectId: "p", title: "x" });
    await store.upsert("tasks", t);
    await expect(
      store.transaction(async (tx) => {
        await tx.softDelete("tasks", t.id, "2026-05-09T12:00:00.000Z");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const after = await store.findById("tasks", t.id);
    expect(after?.deletedAt).toBeNull();
  });
});
