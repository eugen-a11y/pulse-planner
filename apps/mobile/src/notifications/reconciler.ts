/**
 * Pure notification reconciler.
 *
 * Computes the diff between the currently-scheduled iOS notification set and
 * the task list. Pure function — no side effects, fully testable in Node.
 *
 * iOS hard-caps queued local notifications at 64. We reserve 4 for system
 * use (sync alerts, etc.) and cap at 60 by default.
 *
 * The reconciler intentionally does NOT know about recurrence: the next
 * occurrence is materialized as a separate task row by `tasks.complete`
 * (see `apps/desktop/src/main/ipc.ts` lines 268-298 and the mobile mirror
 * in `apps/mobile/src/stores/tasks.ts` `complete()`). The reconciler just
 * schedules whatever rows currently carry a future `dueDate`.
 */

export type TaskNotificationSpec = {
  taskId: string;
  title: string;
  fireAt: string; // ISO
  body?: string;
};

export type ScheduledEntry = {
  taskId: string;
  fireAt: string; // ISO of currently scheduled fire time
};

export type ReconcilerTask = {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
  deletedAt: string | null;
};

export type ReconcileResult = {
  toCancel: string[];          // taskIds to cancel
  toSchedule: TaskNotificationSpec[]; // specs to schedule
  toKeep: string[];            // taskIds with correct schedule already
};

const DEFAULT_MAX = 60;

export function reconcile(
  tasks: readonly ReconcilerTask[],
  scheduled: readonly ScheduledEntry[],
  now: Date,
  options?: { maxScheduled?: number },
): ReconcileResult {
  const maxScheduled = options?.maxScheduled ?? DEFAULT_MAX;
  const nowIso = now.toISOString();

  // 1) Filter to active, future-due tasks.
  const active = tasks.filter((t) =>
    t.status !== "done" &&
    !t.deletedAt &&
    t.dueDate !== null &&
    t.dueDate > nowIso,
  );

  // 2) Sort by dueDate ascending.
  active.sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : 0));

  // 3) Cap.
  const eligible = active.slice(0, maxScheduled);
  const eligibleById = new Map<string, ReconcilerTask>();
  for (const t of eligible) eligibleById.set(t.id, t);

  // 4) Index existing scheduled entries by taskId. Note: if there are
  //    duplicates (shouldn't normally happen, but defensively), keep them
  //    all on the cancel list except for a single match.
  const scheduledByTask = new Map<string, ScheduledEntry[]>();
  for (const s of scheduled) {
    const arr = scheduledByTask.get(s.taskId) ?? [];
    arr.push(s);
    scheduledByTask.set(s.taskId, arr);
  }

  const toCancel: string[] = [];
  const toSchedule: TaskNotificationSpec[] = [];
  const toKeep: string[] = [];

  // Walk eligible tasks; classify.
  for (const t of eligible) {
    const existing = scheduledByTask.get(t.id) ?? [];
    const fireAt = t.dueDate as string;
    const match = existing.find((e) => e.fireAt === fireAt);
    if (match && existing.length === 1) {
      toKeep.push(t.id);
    } else {
      if (existing.length > 0) toCancel.push(t.id);
      toSchedule.push({ taskId: t.id, title: t.title, fireAt });
    }
  }

  // Walk scheduled entries; anything not in eligible set must be canceled.
  for (const s of scheduled) {
    if (!eligibleById.has(s.taskId)) {
      if (!toCancel.includes(s.taskId)) toCancel.push(s.taskId);
    }
  }

  return { toCancel, toSchedule, toKeep };
}
