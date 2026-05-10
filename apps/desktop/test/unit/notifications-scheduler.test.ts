import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NotificationScheduler, type FireFn } from "../../src/main/notifications.js";
import type { Task } from "@pulse/core";

function task(partial: Partial<Task>): Task {
  return {
    id: partial.id ?? "t1", userId: "u1", projectId: "p1", parentTaskId: null,
    title: partial.title ?? "X", description: null,
    status: partial.status ?? "todo", priority: 3,
    dueDate: partial.dueDate ?? null, completedAt: null, sortOrder: 0,
    recurrenceRule: null, recurrenceParentId: null,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null,
  };
}

describe("NotificationScheduler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("schedules timeout for tasks due in the next 24h", () => {
    const fire = vi.fn() satisfies FireFn;
    const sched = new NotificationScheduler(fire);
    const now = new Date("2026-05-09T10:00:00.000Z");
    vi.setSystemTime(now);
    sched.reschedule([task({ id: "a", dueDate: "2026-05-09T10:00:30.000Z" })]);
    vi.advanceTimersByTime(30_500);
    expect(fire).toHaveBeenCalledTimes(1);
    expect(fire.mock.calls[0]![0].id).toBe("a");
  });

  it("skips tasks beyond 24h", () => {
    const fire = vi.fn() satisfies FireFn;
    const sched = new NotificationScheduler(fire);
    const now = new Date("2026-05-09T10:00:00.000Z");
    vi.setSystemTime(now);
    sched.reschedule([task({ id: "future", dueDate: "2026-05-12T10:00:00.000Z" })]);
    vi.advanceTimersByTime(24 * 3600 * 1000);
    expect(fire).not.toHaveBeenCalled();
  });

  it("fires immediately for already-overdue tasks (within 5 min)", () => {
    const fire = vi.fn() satisfies FireFn;
    const sched = new NotificationScheduler(fire);
    const now = new Date("2026-05-09T10:05:00.000Z");
    vi.setSystemTime(now);
    sched.reschedule([task({ id: "missed", dueDate: "2026-05-09T10:02:00.000Z" })]);
    vi.advanceTimersByTime(0);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("skips overdue beyond 5 min", () => {
    const fire = vi.fn() satisfies FireFn;
    const sched = new NotificationScheduler(fire);
    const now = new Date("2026-05-09T11:00:00.000Z");
    vi.setSystemTime(now);
    sched.reschedule([task({ id: "missed", dueDate: "2026-05-09T10:00:00.000Z" })]);
    vi.advanceTimersByTime(0);
    expect(fire).not.toHaveBeenCalled();
  });

  it("reschedule clears pending timers from prior calls", () => {
    const fire = vi.fn() satisfies FireFn;
    const sched = new NotificationScheduler(fire);
    const now = new Date("2026-05-09T10:00:00.000Z");
    vi.setSystemTime(now);
    sched.reschedule([task({ id: "a", dueDate: "2026-05-09T10:00:30.000Z" })]);
    sched.reschedule([]); // cancel
    vi.advanceTimersByTime(60_000);
    expect(fire).not.toHaveBeenCalled();
  });

  it("ignores done or deleted tasks", () => {
    const fire = vi.fn() satisfies FireFn;
    const sched = new NotificationScheduler(fire);
    vi.setSystemTime(new Date("2026-05-09T10:00:00.000Z"));
    sched.reschedule([
      task({ id: "done", status: "done", dueDate: "2026-05-09T10:00:30.000Z" }),
      { ...task({ id: "del" }), dueDate: "2026-05-09T10:00:30.000Z", deletedAt: "2026-05-09T10:00:00.000Z" },
    ]);
    vi.advanceTimersByTime(60_000);
    expect(fire).not.toHaveBeenCalled();
  });
});
