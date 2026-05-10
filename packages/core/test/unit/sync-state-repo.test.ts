import { describe, expect, it } from "vitest";
import { InMemorySyncStateRepo } from "../../src/sync/sync-state-repo.js";

describe("InMemorySyncStateRepo", () => {
  it("returns null for unseen tables", async () => {
    const repo = new InMemorySyncStateRepo();
    expect(await repo.getCursor("tasks")).toBeNull();
  });

  it("stores and reads cursor by table", async () => {
    const repo = new InMemorySyncStateRepo();
    await repo.setCursor("tasks", "2026-05-09T10:00:00.000Z");
    expect(await repo.getCursor("tasks")).toBe("2026-05-09T10:00:00.000Z");
    expect(await repo.getCursor("projects")).toBeNull();
  });

  it("overwrites cursor on second set", async () => {
    const repo = new InMemorySyncStateRepo();
    await repo.setCursor("tasks", "2026-05-09T10:00:00.000Z");
    await repo.setCursor("tasks", "2026-05-09T11:00:00.000Z");
    expect(await repo.getCursor("tasks")).toBe("2026-05-09T11:00:00.000Z");
  });
});
