import { describe, expect, it, vi } from "vitest";
import { SyncEngine } from "../../src/sync/sync-engine.js";
import { Outbox } from "../../src/sync/outbox.js";
import { InMemoryStore } from "../../src/store/in-memory-store.js";

function makeFakeSupabase(rpcImpl: (args: any) => Promise<{ data: any; error: any }>) {
  return {
    rpc: vi.fn(async (_name: string, args: any) => rpcImpl(args)),
    from: () => ({
      select: () => ({
        gt: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), unsubscribe: () => {} }),
  } as any;
}

describe("SyncEngine.push", () => {
  it("drains outbox in FIFO and acks each entry on success", async () => {
    const calls: any[] = [];
    const supa = makeFakeSupabase(async (args) => {
      calls.push(args);
      return { data: "2026-05-09T00:00:00.000Z", error: null };
    });
    const ob = new Outbox();
    const store = new InMemoryStore();
    const engine = new SyncEngine({ supabase: supa, outbox: ob, store, userId: "u" });

    await ob.enqueue({
      entityTable: "tasks", entityId: "id1", op: "update",
      changedFields: { status: "done" }, clientTs: "2026-05-09T00:00:00.000Z",
    });
    await ob.enqueue({
      entityTable: "tasks", entityId: "id2", op: "insert",
      changedFields: { id: "id2", project_id: "p", title: "x" }, clientTs: "2026-05-09T00:00:01.000Z",
    });

    await engine.push();

    expect(calls.map((c) => c.p_id)).toEqual(["id1", "id2"]);
    expect(await ob.peekAll()).toEqual([]);
  });

  it("nacks entry on RPC error and stops draining further entries", async () => {
    const supa = makeFakeSupabase(async () => ({ data: null, error: { message: "boom" } }));
    const ob = new Outbox();
    const store = new InMemoryStore();
    const engine = new SyncEngine({ supabase: supa, outbox: ob, store, userId: "u" });

    await ob.enqueue({ entityTable: "tasks", entityId: "id1", op: "update", changedFields: {}, clientTs: "2026-05-09T00:00:00.000Z" });
    await ob.enqueue({ entityTable: "tasks", entityId: "id2", op: "update", changedFields: {}, clientTs: "2026-05-09T00:00:01.000Z" });

    await engine.push();
    const remaining = await ob.peekAll();
    expect(remaining).toHaveLength(2);
    expect(remaining[0]!.attempts).toBe(1);
    expect(remaining[0]!.lastError).toBe("boom");
  });

  it("sends camelCase fields as snake_case to RPC", async () => {
    const calls: any[] = [];
    const supa = makeFakeSupabase(async (args) => {
      calls.push(args);
      return { data: "2026-05-09T00:00:00.000Z", error: null };
    });
    const ob = new Outbox();
    const engine = new SyncEngine({ supabase: supa, outbox: ob, store: new InMemoryStore(), userId: "u" });

    await ob.enqueue({
      entityTable: "tasks", entityId: "id1", op: "update",
      changedFields: { dueDate: "2026-05-15", parentTaskId: null, sortOrder: 1 },
      clientTs: "2026-05-09T00:00:00.000Z",
    });

    await engine.push();
    expect(calls[0]!.p_changes).toEqual({
      due_date: "2026-05-15",
      parent_task_id: null,
      sort_order: 1,
    });
  });
});
