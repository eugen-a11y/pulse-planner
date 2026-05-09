import { describe, expect, it } from "vitest";
import { collectOutstandingFields, mergeRemoteWithOutbox } from "../../src/sync/conflict.js";

describe("mergeRemoteWithOutbox", () => {
  it("returns remote unchanged when no outstanding outbox fields", () => {
    const local = { id: "1", title: "old", status: "todo" };
    const remote = { id: "1", title: "new", status: "in_progress" };
    const merged = mergeRemoteWithOutbox(local, remote, []);
    expect(merged).toEqual(remote);
  });

  it("preserves locally-changed field over remote value", () => {
    const local = { id: "1", title: "local edit", status: "todo" };
    const remote = { id: "1", title: "remote edit", status: "done" };
    const merged = mergeRemoteWithOutbox(local, remote, ["title"]);
    expect(merged.title).toBe("local edit");
    expect(merged.status).toBe("done");
  });

  it("multiple outstanding fields all preserved", () => {
    const local = { a: 1, b: 2, c: 3 };
    const remote = { a: 10, b: 20, c: 30 };
    const merged = mergeRemoteWithOutbox(local, remote, ["a", "c"]);
    expect(merged).toEqual({ a: 1, b: 20, c: 3 });
  });

  it("outstandingFields collects field names across multiple outbox entries for the same row", () => {
    const fields = collectOutstandingFields([
      { entityTable: "tasks", entityId: "1", changedFields: { title: "x" } },
      { entityTable: "tasks", entityId: "1", changedFields: { status: "done" } },
      { entityTable: "tasks", entityId: "2", changedFields: { title: "y" } },
    ], "tasks", "1");
    expect(fields.sort()).toEqual(["status", "title"]);
  });
});
