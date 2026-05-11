import { describe, expect, it, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { Outbox, ALL_DDL } from "@pulse/core";
import { BetterSqliteStore } from "../../src/main/store/better-sqlite-store.js";
import { TimerService } from "../../src/main/timer.js";

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(ALL_DDL);
  return db;
}

describe("TimerService", () => {
  let db: Database.Database;
  let store: BetterSqliteStore;
  let outbox: Outbox;
  let timer: TimerService;

  beforeEach(() => {
    db = freshDb();
    store = new BetterSqliteStore(db);
    outbox = new Outbox();
    timer = new TimerService({ store, outbox, userId: "u1" });
  });

  it("start creates a TimeEntry and sets current", async () => {
    const entry = await timer.start("task-1");
    expect(entry.taskId).toBe("task-1");
    expect(entry.endedAt).toBeNull();
    expect(timer.current()).toEqual({ taskId: "task-1", startedAt: entry.startedAt });
  });

  it("starting a new timer stops the previous one", async () => {
    await timer.start("task-1");
    await new Promise((r) => setTimeout(r, 5));
    await timer.start("task-2");
    expect(timer.current()?.taskId).toBe("task-2");
  });

  it("stop sets endedAt and returns the stopped entry", async () => {
    const started = await timer.start("task-1");
    await new Promise((r) => setTimeout(r, 5));
    const stopped = await timer.stop();
    expect(stopped?.endedAt).not.toBeNull();
    expect(stopped?.startedAt).toBe(started.startedAt);
    expect(timer.current()).toBeNull();
  });

  it("stop when no timer running returns null", async () => {
    expect(await timer.stop()).toBeNull();
  });

  it("recoverFromStore picks up an unfinished entry across process restarts", async () => {
    await timer.start("task-1");
    const recovered = new TimerService({ store, outbox, userId: "u1" });
    await recovered.init();
    expect(recovered.current()?.taskId).toBe("task-1");
  });
});
