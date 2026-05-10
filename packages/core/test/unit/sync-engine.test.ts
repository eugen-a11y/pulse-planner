import { describe, expect, it, vi } from "vitest";
import { SyncEngine } from "../../src/sync/sync-engine.js";
import { Outbox } from "../../src/sync/outbox.js";
import { InMemoryStore } from "../../src/store/in-memory-store.js";
import { InMemorySyncStateRepo } from "../../src/sync/sync-state-repo.js";

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

describe("SyncEngine.pull", () => {
  it("queries each table for rows updated after the cursor and upserts them", async () => {
    const fetched: Record<string, any[]> = {
      projects: [{ id: "p1", user_id: "u", name: "Hello", color: "#2563eb",
                   archived: false, sort_order: 0,
                   created_at: "2026-05-09T00:00:00.000Z",
                   updated_at: "2026-05-09T00:00:01.000Z",
                   deleted_at: null }],
    };
    const supa = {
      rpc: vi.fn(),
      from: (t: string) => ({
        select: () => ({
          gt: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: fetched[t] ?? [], error: null }),
            }),
          }),
        }),
      }),
    } as any;
    const store = new InMemoryStore();
    const engine = new SyncEngine({ supabase: supa, outbox: new Outbox(), store, userId: "u" });

    const newCursor = await engine.pull(null);
    expect(newCursor).toBe("2026-05-09T00:00:01.000Z");
    const got = await store.findById("projects", "p1");
    expect(got?.id).toBe("p1");
    expect((got as any).name).toBe("Hello");
  });

  it("returns the previous cursor when nothing new arrives", async () => {
    const supa = {
      rpc: vi.fn(),
      from: () => ({
        select: () => ({
          gt: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }),
    } as any;
    const engine = new SyncEngine({ supabase: supa, outbox: new Outbox(), store: new InMemoryStore(), userId: "u" });
    expect(await engine.pull("2026-05-09T00:00:00.000Z")).toBe("2026-05-09T00:00:00.000Z");
  });

  it("preserves outbox-changed fields when applying remote update", async () => {
    const remote = [{
      id: "p1", user_id: "u", name: "REMOTE", color: "#2563eb",
      archived: false, sort_order: 0,
      created_at: "2026-05-09T00:00:00.000Z",
      updated_at: "2026-05-09T00:00:02.000Z",
      deleted_at: null,
    }];
    const supa = {
      rpc: vi.fn(),
      from: (t: string) => ({
        select: () => ({
          gt: () => ({
            eq: () => ({
              order: () => Promise.resolve({
                data: t === "projects" ? remote : [],
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as any;
    const store = new InMemoryStore();
    await store.upsert("projects", {
      id: "p1", userId: "u", name: "LOCAL", color: "#2563eb",
      archived: false, sortOrder: 0,
      createdAt: "2026-05-09T00:00:00.000Z",
      updatedAt: "2026-05-09T00:00:01.000Z",
      deletedAt: null,
    } as any);

    const ob = new Outbox();
    await ob.enqueue({
      entityTable: "projects", entityId: "p1", op: "update",
      changedFields: { name: "LOCAL" },
      clientTs: "2026-05-09T00:00:01.000Z",
    });

    const engine = new SyncEngine({ supabase: supa, outbox: ob, store, userId: "u" });
    await engine.pull(null);
    const got = await store.findById<any>("projects", "p1");
    expect(got!.name).toBe("LOCAL");          // outbox wins
  });
});

describe("SyncEngine.pull with SyncStateRepo", () => {
  it("reads + writes cursor via repo when injected", async () => {
    const fetched: Record<string, any[]> = {
      projects: [{ id: "p1", user_id: "u", name: "Hello", color: "#2563eb",
                   archived: false, sort_order: 0,
                   created_at: "2026-05-09T00:00:00.000Z",
                   updated_at: "2026-05-09T00:00:01.000Z",
                   deleted_at: null }],
    };
    const supa = {
      rpc: vi.fn(),
      from: (t: string) => ({
        select: () => ({
          gt: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: fetched[t] ?? [], error: null }),
            }),
          }),
        }),
      }),
    } as any;
    const store = new InMemoryStore();
    const stateRepo = new InMemorySyncStateRepo();
    const engine = new SyncEngine({ supabase: supa, outbox: new Outbox(), store, userId: "u", stateRepo });

    await engine.pull();
    expect(await stateRepo.getCursor("projects")).toBe("2026-05-09T00:00:01.000Z");
  });
});

describe("SyncEngine.subscribeRealtime", () => {
  it("calls back when realtime payload arrives", async () => {
    let registered: ((payload: any) => void) | null = null;
    const channel = {
      on: vi.fn((_e: string, _f: any, cb: any) => { registered = cb; return channel; }),
      subscribe: vi.fn(),
    };
    const supa = {
      rpc: vi.fn(),
      from: () => ({}),
      channel: vi.fn(() => channel),
    } as any;
    const engine = new SyncEngine({ supabase: supa, outbox: new Outbox(), store: new InMemoryStore(), userId: "u" });

    let hits = 0;
    const unsub = engine.subscribeRealtime(() => { hits++; });
    registered?.({ new: { id: "x" } });
    expect(hits).toBe(1);
    expect(typeof unsub).toBe("function");
  });
});
