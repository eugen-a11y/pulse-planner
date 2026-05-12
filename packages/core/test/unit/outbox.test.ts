import { describe, expect, it } from "vitest";
import { Outbox, type OutboxEntry } from "../../src/sync/outbox.js";

const entry = (id: string, table = "tasks"): Omit<OutboxEntry, "queuedAt" | "attempts"> => ({
  entityTable: table as OutboxEntry["entityTable"],
  entityId: id,
  op: "update",
  changedFields: { title: "x" },
  clientTs: "2026-05-09T00:00:00.000Z",
});

describe("Outbox", () => {
  it("enqueues and drains in FIFO order", async () => {
    const ob = new Outbox();
    await ob.enqueue(entry("a"));
    await ob.enqueue(entry("b"));
    expect((await ob.peekAll()).map((e) => e.entityId)).toEqual(["a", "b"]);
  });

  it("ack removes the entry", async () => {
    const ob = new Outbox();
    await ob.enqueue(entry("a"));
    const all = await ob.peekAll();
    await ob.ack(all[0]!.queuedAt);
    expect(await ob.peekAll()).toEqual([]);
  });

  it("nack increments attempts and stores last error", async () => {
    const ob = new Outbox();
    await ob.enqueue(entry("a"));
    const [first] = await ob.peekAll();
    await ob.nack(first!.queuedAt, "network error");
    const [retry] = await ob.peekAll();
    expect(retry!.attempts).toBe(1);
    expect(retry!.lastError).toBe("network error");
  });

  it("discard removes the entry without ack semantics", async () => {
    const ob = new Outbox();
    await ob.enqueue(entry("a"));
    // Stagger to avoid identical queuedAt timestamps on fast machines.
    await new Promise((r) => setTimeout(r, 2));
    await ob.enqueue(entry("b"));
    const all = await ob.peekAll();
    expect(all.length).toBe(2);
    await ob.discard(all[0]!.queuedAt);
    const remaining = await ob.peekAll();
    expect(remaining.map((e) => e.entityId)).toEqual(["b"]);
  });

  it("backoffMs grows exponentially capped at 5 minutes", () => {
    expect(Outbox.backoffMs(0)).toBe(0);
    expect(Outbox.backoffMs(1)).toBe(1_000);
    expect(Outbox.backoffMs(2)).toBe(2_000);
    expect(Outbox.backoffMs(8)).toBe(128_000);
    expect(Outbox.backoffMs(20)).toBe(300_000);
  });
});
