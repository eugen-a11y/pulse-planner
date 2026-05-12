/**
 * Tests for the pure notification reconciler.
 *
 * The reconciler takes (tasks, scheduled, now) and returns
 * { toCancel, toSchedule, toKeep } — describing how to bring the current
 * scheduled-notification set in line with the current task list.
 *
 * Rules:
 *  - Filter out done / deleted / null-due / past-due tasks.
 *  - Sort by dueDate ascending.
 *  - Cap at maxScheduled (default 60, reserving 4 of iOS's 64 hard limit).
 *  - Idempotent: tasks scheduled at the exact dueDate stay in `toKeep`.
 *  - Reschedule when dueDate changes: cancel old, add new.
 *  - Cancel scheduled entries whose taskId is no longer in the filtered set.
 */
import { describe, expect, it } from "@jest/globals";
import { reconcile, type ScheduledEntry } from "../../src/notifications/reconciler";

type Task = {
  id: string; title: string; dueDate: string | null;
  status: string; deletedAt: string | null;
};

const now = new Date("2026-06-01T10:00:00Z");

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    id: partial.id,
    title: partial.title ?? `Task ${partial.id}`,
    dueDate: partial.dueDate ?? null,
    status: partial.status ?? "todo",
    deletedAt: partial.deletedAt ?? null,
  };
}

describe("reconcile", () => {
  it("skips past-due tasks", () => {
    const past = task({ id: "t1", dueDate: "2026-05-30T09:00:00Z" });
    const future = task({ id: "t2", dueDate: "2026-06-02T09:00:00Z" });
    const out = reconcile([past, future], [], now);
    expect(out.toSchedule.map((s) => s.taskId)).toEqual(["t2"]);
    expect(out.toCancel).toEqual([]);
  });

  it("ignores done tasks", () => {
    const t = task({ id: "t1", dueDate: "2026-06-02T09:00:00Z", status: "done" });
    const out = reconcile([t], [], now);
    expect(out.toSchedule).toEqual([]);
  });

  it("ignores deleted tasks", () => {
    const t = task({
      id: "t1", dueDate: "2026-06-02T09:00:00Z",
      deletedAt: "2026-05-31T00:00:00Z",
    });
    const out = reconcile([t], [], now);
    expect(out.toSchedule).toEqual([]);
  });

  it("ignores tasks with null dueDate", () => {
    const t = task({ id: "t1", dueDate: null });
    const out = reconcile([t], [], now);
    expect(out.toSchedule).toEqual([]);
  });

  it("caps at maxScheduled, taking soonest dueDate first", () => {
    const tasks: Task[] = [];
    // 100 tasks at hourly intervals starting at now+1h.
    for (let i = 0; i < 100; i++) {
      const due = new Date(now.getTime() + (i + 1) * 3600_000).toISOString();
      tasks.push(task({ id: `t${i}`, dueDate: due }));
    }
    // shuffle a bit so sort is exercised
    tasks.reverse();
    const out = reconcile(tasks, [], now, { maxScheduled: 60 });
    expect(out.toSchedule).toHaveLength(60);
    // first scheduled should be the earliest due (t0)
    expect(out.toSchedule[0].taskId).toBe("t0");
    expect(out.toSchedule[59].taskId).toBe("t59");
  });

  it("default cap is 60", () => {
    const tasks: Task[] = [];
    for (let i = 0; i < 70; i++) {
      const due = new Date(now.getTime() + (i + 1) * 3600_000).toISOString();
      tasks.push(task({ id: `t${i}`, dueDate: due }));
    }
    const out = reconcile(tasks, [], now);
    expect(out.toSchedule).toHaveLength(60);
  });

  it("returns empty diff when scheduled matches tasks (idempotent)", () => {
    const due = "2026-06-02T09:00:00Z";
    const t = task({ id: "t1", dueDate: due });
    const scheduled: ScheduledEntry[] = [{ taskId: "t1", fireAt: due }];
    const out = reconcile([t], scheduled, now);
    expect(out.toCancel).toEqual([]);
    expect(out.toSchedule).toEqual([]);
    expect(out.toKeep).toEqual(["t1"]);
  });

  it("reschedules when dueDate changes (cancel + schedule)", () => {
    const oldDue = "2026-06-02T09:00:00Z";
    const newDue = "2026-06-03T15:00:00Z";
    const t = task({ id: "t1", dueDate: newDue });
    const scheduled: ScheduledEntry[] = [{ taskId: "t1", fireAt: oldDue }];
    const out = reconcile([t], scheduled, now);
    expect(out.toCancel).toEqual(["t1"]);
    expect(out.toSchedule).toHaveLength(1);
    expect(out.toSchedule[0]).toMatchObject({ taskId: "t1", fireAt: newDue });
    expect(out.toKeep).toEqual([]);
  });

  it("cancels tasks no longer due (removed / completed / deleted)", () => {
    const t = task({ id: "t2", dueDate: "2026-06-02T09:00:00Z" });
    const scheduled: ScheduledEntry[] = [
      { taskId: "t1", fireAt: "2026-06-02T09:00:00Z" }, // not in task list
      { taskId: "t2", fireAt: "2026-06-02T09:00:00Z" }, // still due
    ];
    const out = reconcile([t], scheduled, now);
    expect(out.toCancel).toEqual(["t1"]);
    expect(out.toSchedule).toEqual([]);
    expect(out.toKeep).toEqual(["t2"]);
  });

  it("cancels scheduled tasks that became done", () => {
    const t = task({ id: "t1", dueDate: "2026-06-02T09:00:00Z", status: "done" });
    const scheduled: ScheduledEntry[] = [
      { taskId: "t1", fireAt: "2026-06-02T09:00:00Z" },
    ];
    const out = reconcile([t], scheduled, now);
    expect(out.toCancel).toEqual(["t1"]);
    expect(out.toSchedule).toEqual([]);
  });

  it("schedules brand-new task with no prior schedule", () => {
    const t = task({ id: "t1", dueDate: "2026-06-02T09:00:00Z", title: "Buy milk" });
    const out = reconcile([t], [], now);
    expect(out.toSchedule).toEqual([
      { taskId: "t1", title: "Buy milk", fireAt: "2026-06-02T09:00:00Z" },
    ]);
    expect(out.toCancel).toEqual([]);
  });

  it("cancels schedule overflow beyond maxScheduled cap", () => {
    // 5 tasks; cap at 2. The 3 not chosen for scheduling should also be canceled
    // if they were previously scheduled.
    const tasks: Task[] = [];
    const scheduled: ScheduledEntry[] = [];
    for (let i = 0; i < 5; i++) {
      const due = new Date(now.getTime() + (i + 1) * 3600_000).toISOString();
      tasks.push(task({ id: `t${i}`, dueDate: due }));
      scheduled.push({ taskId: `t${i}`, fireAt: due });
    }
    const out = reconcile(tasks, scheduled, now, { maxScheduled: 2 });
    // first two kept (t0, t1), last three canceled (t2, t3, t4).
    expect(out.toKeep.sort()).toEqual(["t0", "t1"]);
    expect(out.toCancel.sort()).toEqual(["t2", "t3", "t4"]);
    expect(out.toSchedule).toEqual([]);
  });
});
