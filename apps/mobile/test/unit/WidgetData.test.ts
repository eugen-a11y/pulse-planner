/**
 * WidgetData unit tests.
 *
 * Covers the pure `buildTodaySnapshot` selector (filtering, sorting, capping,
 * project-color resolution) and a round-trip through `writeSnapshot` /
 * `readSnapshot` against the in-memory expo-file-system mock.
 *
 * The native widget-reload (WidgetCenter.reloadAllTimelines) is not invoked
 * in v1; iOS picks up the file change on its next timeline tick.
 */

import { describe, expect, it, beforeEach } from "@jest/globals";
import {
  buildTodaySnapshot,
  readSnapshot,
  writeSnapshot,
  type BuildSnapshotInput,
  type WidgetSnapshot,
} from "../../src/platform/WidgetData";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("expo-file-system") as { __reset: () => void };

function task(overrides: Partial<BuildSnapshotInput["tasks"][number]>): BuildSnapshotInput["tasks"][number] {
  return {
    id: "t" + Math.random().toString(36).slice(2, 8),
    title: "T",
    dueDate: null,
    status: "todo",
    deletedAt: null,
    projectId: null,
    ...overrides,
  };
}

const NOW = new Date("2026-05-12T15:00:00.000Z");

describe("buildTodaySnapshot", () => {
  it("sets generatedAt to now.toISOString()", () => {
    const snap = buildTodaySnapshot({ now: NOW, tasks: [], projects: [] });
    expect(snap.generatedAt).toBe(NOW.toISOString());
    expect(snap.tasks).toEqual([]);
  });

  it("filters tasks without dueDate", () => {
    const snap = buildTodaySnapshot({
      now: NOW,
      tasks: [task({ id: "a", title: "no-due", dueDate: null })],
      projects: [],
    });
    expect(snap.tasks).toEqual([]);
  });

  it("filters done tasks", () => {
    const snap = buildTodaySnapshot({
      now: NOW,
      tasks: [task({ id: "a", status: "done", dueDate: "2026-05-12T10:00:00.000Z" })],
      projects: [],
    });
    expect(snap.tasks).toEqual([]);
  });

  it("filters deleted tasks", () => {
    const snap = buildTodaySnapshot({
      now: NOW,
      tasks: [task({ id: "a", deletedAt: "2026-05-10T10:00:00.000Z", dueDate: "2026-05-12T10:00:00.000Z" })],
      projects: [],
    });
    expect(snap.tasks).toEqual([]);
  });

  it("includes overdue tasks", () => {
    const snap = buildTodaySnapshot({
      now: NOW,
      tasks: [task({ id: "a", title: "overdue", dueDate: "2026-05-10T09:00:00.000Z" })],
      projects: [],
    });
    expect(snap.tasks.map((t) => t.id)).toEqual(["a"]);
  });

  it("excludes tasks due after today (end-of-day cutoff)", () => {
    // tomorrow 00:00 UTC is *after* today's local end-of-day in most TZs, but
    // the spec uses end-of-day in the runtime locale. We compute the cutoff
    // off `now`'s setHours(23,59,59,999). A due-date >24h ahead is definitely
    // excluded regardless of TZ.
    const snap = buildTodaySnapshot({
      now: NOW,
      tasks: [task({ id: "future", dueDate: "2026-05-20T09:00:00.000Z" })],
      projects: [],
    });
    expect(snap.tasks).toEqual([]);
  });

  it("sorts overdue first, then by dueDate ascending", () => {
    const snap = buildTodaySnapshot({
      now: NOW,
      tasks: [
        task({ id: "todayLate", dueDate: "2026-05-12T20:00:00.000Z" }),
        task({ id: "overdueOld", dueDate: "2026-05-09T09:00:00.000Z" }),
        task({ id: "todayEarly", dueDate: "2026-05-12T10:00:00.000Z" }),
        task({ id: "overdueRecent", dueDate: "2026-05-11T09:00:00.000Z" }),
      ],
      projects: [],
    });
    expect(snap.tasks.map((t) => t.id)).toEqual([
      "overdueOld",
      "overdueRecent",
      "todayEarly",
      "todayLate",
    ]);
  });

  it("caps at maxItems (default 5)", () => {
    const tasks = Array.from({ length: 12 }, (_, i) =>
      task({ id: "t" + i, dueDate: `2026-05-12T${String(10 + (i % 12)).padStart(2, "0")}:00:00.000Z` }),
    );
    const snap = buildTodaySnapshot({ now: NOW, tasks, projects: [] });
    expect(snap.tasks.length).toBe(5);
  });

  it("honors a custom maxItems", () => {
    const tasks = Array.from({ length: 4 }, (_, i) =>
      task({ id: "t" + i, dueDate: `2026-05-12T${String(10 + i).padStart(2, "0")}:00:00.000Z` }),
    );
    const snap = buildTodaySnapshot({ now: NOW, tasks, projects: [], maxItems: 2 });
    expect(snap.tasks.length).toBe(2);
  });

  it("maps projectColor from projects by projectId", () => {
    const snap = buildTodaySnapshot({
      now: NOW,
      tasks: [
        task({ id: "a", dueDate: "2026-05-12T10:00:00.000Z", projectId: "p1" }),
        task({ id: "b", dueDate: "2026-05-12T11:00:00.000Z", projectId: "p2" }),
        task({ id: "c", dueDate: "2026-05-12T12:00:00.000Z", projectId: null }),
        task({ id: "d", dueDate: "2026-05-12T13:00:00.000Z", projectId: "missing" }),
      ],
      projects: [
        { id: "p1", color: "#2563EB" },
        { id: "p2", color: null },
      ],
    });
    const byId = Object.fromEntries(snap.tasks.map((t) => [t.id, t]));
    expect(byId.a.projectColor).toBe("#2563EB");
    expect(byId.b.projectColor).toBe(null);
    expect(byId.c.projectColor).toBe(null);
    expect(byId.d.projectColor).toBe(null);
  });

  it("maps title and due (ISO) onto snapshot tasks", () => {
    const snap = buildTodaySnapshot({
      now: NOW,
      tasks: [task({ id: "a", title: "Hello", dueDate: "2026-05-12T10:00:00.000Z" })],
      projects: [],
    });
    expect(snap.tasks[0]).toEqual({
      id: "a",
      title: "Hello",
      due: "2026-05-12T10:00:00.000Z",
      projectColor: null,
    });
  });
});

describe("writeSnapshot / readSnapshot", () => {
  beforeEach(() => {
    fs.__reset();
  });

  it("round-trips a snapshot through the App-Group path", async () => {
    const snap: WidgetSnapshot = {
      generatedAt: "2026-05-12T15:00:00.000Z",
      tasks: [{ id: "a", title: "Task A", due: "2026-05-12T10:00:00.000Z", projectColor: "#2563EB" }],
    };
    await writeSnapshot(snap);
    const got = await readSnapshot();
    expect(got).toEqual(snap);
  });

  it("readSnapshot returns null when no file exists", async () => {
    const got = await readSnapshot();
    expect(got).toBeNull();
  });

  it("writeSnapshot does not throw when filesystem fails", async () => {
    // Simulate failure by monkey-patching the mock.
    const realFs = require("expo-file-system");
    const original = realFs.writeAsStringAsync;
    realFs.writeAsStringAsync = async () => { throw new Error("boom"); };
    try {
      await expect(writeSnapshot({ generatedAt: "x", tasks: [] })).resolves.toBeUndefined();
    } finally {
      realFs.writeAsStringAsync = original;
    }
  });
});
