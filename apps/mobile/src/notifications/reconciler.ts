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
  /**
   * Minutes before dueDate to fire the local notification.
   *   null  → no reminder, skip scheduling entirely.
   *   0     → fire exactly at dueDate.
   *   N>0   → fire at dueDate − N minutes.
   */
  reminderOffsetMinutes: number | null;
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
  const nowMs = now.getTime();

  // Compute (fireAt = dueDate − reminderOffsetMinutes) per task. Tasks without
  // a reminderOffsetMinutes get no scheduling slot. Filter to active +
  // future fireAt (not future dueDate — a 1h reminder for a 30min-future task
  // is already past).
  type Enriched = { task: ReconcilerTask; fireAt: string };
  const active: Enriched[] = [];
  for (const t of tasks) {
    if (t.status === "done") continue;
    if (t.deletedAt) continue;
    if (t.dueDate === null) continue;
    if (t.reminderOffsetMinutes === null || t.reminderOffsetMinutes === undefined) continue;
    const dueMs = Date.parse(t.dueDate);
    if (!Number.isFinite(dueMs)) continue;
    const fireMs = dueMs - t.reminderOffsetMinutes * 60_000;
    if (fireMs <= nowMs) continue;
    active.push({ task: t, fireAt: new Date(fireMs).toISOString() });
  }

  // Sort by fireAt ascending (earliest fires first).
  active.sort((a, b) => (a.fireAt < b.fireAt ? -1 : a.fireAt > b.fireAt ? 1 : 0));

  // Cap.
  const eligible = active.slice(0, maxScheduled);
  const eligibleById = new Map<string, Enriched>();
  for (const e of eligible) eligibleById.set(e.task.id, e);

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
  for (const { task: t, fireAt } of eligible) {
    const existing = scheduledByTask.get(t.id) ?? [];
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
