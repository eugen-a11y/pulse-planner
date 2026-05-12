/**
 * Expo local-notifications adapter.
 *
 * Mirrors `apps/desktop/src/main/notifications.ts` semantically:
 *  - Registers a TASK_DUE notification category with Done / +1h / Tomorrow
 *    action buttons.
 *  - Wraps the scheduling primitives so the rest of the app can speak in
 *    `TaskNotificationSpec` / `ScheduledEntry` shape only.
 *  - Provides `listScheduled()` so the pure reconciler can compute a diff.
 *  - Handles action responses (Done, Snooze) by mutating the tasks store.
 *
 * Stick-to-spec: no advanced scheduling, no per-project quiet hours, no
 * recurring bells. Just the three actions + 60-cap (enforced by the
 * reconciler, not here).
 */
import * as Notifications from "expo-notifications";
import { useTasks } from "@/stores/tasks";
import { prefs } from "@/lib/prefs";
import type { Task } from "@pulse/core";
import type {
  ScheduledEntry,
  TaskNotificationSpec,
} from "@/notifications/reconciler";
import type { MobileDeps } from "@/wiring/deps";

export const TASK_DUE_CATEGORY = "TASK_DUE";

let categoryRegistered = false;
let responseListener: { remove: () => void } | null = null;

// Foreground display: show banner + sound + badge.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register the TASK_DUE category once per process. Idempotent.
 * Buttons mirror desktop tray actions: Done / +1 hour / Tomorrow.
 */
export async function ensureNotificationCategoryRegistered(): Promise<void> {
  if (categoryRegistered) return;
  try {
    await Notifications.setNotificationCategoryAsync(TASK_DUE_CATEGORY, [
      { identifier: "DONE", buttonTitle: "Erledigt", options: { opensAppToForeground: false } },
      { identifier: "SNOOZE_1H", buttonTitle: "+1 Stunde", options: { opensAppToForeground: false } },
      { identifier: "SNOOZE_TOMORROW", buttonTitle: "Morgen", options: { opensAppToForeground: false } },
    ]);
    categoryRegistered = true;
  } catch {
    // Best-effort: on the very first run before permission grant this can
    // throw on some SDK versions. The reconciler will retry next cycle.
  }
}

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  const { status: nextStatus } = await Notifications.requestPermissionsAsync();
  return nextStatus === "granted";
}

/** Schedule a single notification. Returns the Expo identifier. */
export async function scheduleNotification(spec: TaskNotificationSpec): Promise<string> {
  const fireDate = new Date(spec.fireAt);
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: `Fällig: ${spec.title}`,
      body: spec.body,
      data: { taskId: spec.taskId },
      categoryIdentifier: TASK_DUE_CATEGORY,
    },
    trigger: { date: fireDate } as Notifications.DateTriggerInput,
  });
}

/** Cancel every scheduled notification whose data.taskId matches. */
export async function cancelForTask(taskId: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) {
    const data = (n.content?.data ?? {}) as { taskId?: string };
    if (data.taskId === taskId) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Read the live scheduled set as `ScheduledEntry[]` for the reconciler. */
export async function listScheduled(): Promise<ScheduledEntry[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const out: ScheduledEntry[] = [];
  for (const n of all) {
    const data = (n.content?.data ?? {}) as { taskId?: string };
    const taskId = data.taskId;
    if (!taskId) continue;
    const trig = n.trigger as unknown as { date?: unknown; value?: number };
    let fireAt: string | null = null;
    const d = trig?.date;
    if (d instanceof Date) {
      fireAt = d.toISOString();
    } else if (typeof d === "number") {
      fireAt = new Date(d).toISOString();
    } else if (typeof d === "string") {
      fireAt = new Date(d).toISOString();
    } else if (typeof trig?.value === "number") {
      fireAt = new Date(trig.value).toISOString();
    }
    if (fireAt) out.push({ taskId, fireAt });
  }
  return out;
}

// ─── action handler ────────────────────────────────────────────────────

const PENDING_ACTIONS_KEY = "pendingNotificationActions";

type PendingAction = {
  taskId: string;
  actionId: string;
  ts: string;
};

function readPending(): PendingAction[] {
  const raw = prefs.getString(PENDING_ACTIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingAction[]) : [];
  } catch {
    return [];
  }
}

function writePending(list: PendingAction[]): void {
  if (list.length === 0) {
    prefs.delete(PENDING_ACTIONS_KEY);
  } else {
    prefs.set(PENDING_ACTIONS_KEY, JSON.stringify(list));
  }
}

function queuePending(taskId: string, actionId: string): void {
  const list = readPending();
  list.push({ taskId, actionId, ts: new Date().toISOString() });
  writePending(list);
}

let depsReady = false;
export function markNotificationDepsReady(): void {
  depsReady = true;
}

/**
 * Snooze a task by `minutes`. Mirrors desktop's notifications.snooze IPC
 * (`apps/desktop/src/main/ipc.ts:521-538`): load task, bump dueDate,
 * re-upsert + outbox. The reconciler picks up the change on its next run.
 */
async function snoozeTask(deps: MobileDeps | null, taskId: string, minutes: number): Promise<void> {
  if (!deps) return;
  const local = await deps.store.findById<Task>("tasks", taskId);
  if (!local || !local.dueDate) return;
  const next = new Date(new Date(local.dueDate).getTime() + minutes * 60_000).toISOString();
  await useTasks.getState().update(taskId, { dueDate: next });
}

async function applyAction(
  deps: MobileDeps | null,
  taskId: string,
  actionId: string,
  onOpen: (taskId: string) => void,
): Promise<void> {
  switch (actionId) {
    case "DONE":
      try { await useTasks.getState().complete(taskId); } catch { /* best-effort */ }
      break;
    case "SNOOZE_1H":
      try { await snoozeTask(deps, taskId, 60); } catch { /* best-effort */ }
      break;
    case "SNOOZE_TOMORROW":
      try { await snoozeTask(deps, taskId, 24 * 60); } catch { /* best-effort */ }
      break;
    default:
      // Default tap → deep-link to task detail.
      onOpen(taskId);
      break;
  }
}

/**
 * Drain any actions that arrived before deps were ready. Call after
 * `bindStoresToDeps` resolves on app boot.
 */
export async function drainPendingActions(
  deps: MobileDeps,
  onOpen: (taskId: string) => void,
): Promise<void> {
  markNotificationDepsReady();
  const list = readPending();
  if (list.length === 0) return;
  writePending([]);
  for (const a of list) {
    await applyAction(deps, a.taskId, a.actionId, onOpen);
  }
}

/**
 * Register the response listener once. Returns an unsubscribe.
 * The listener is fire-and-forget; we never throw across the FFI boundary.
 */
export function registerResponseListener(
  getDeps: () => MobileDeps | null,
  onOpen: (taskId: string) => void,
): () => void {
  if (responseListener) responseListener.remove();
  responseListener = Notifications.addNotificationResponseReceivedListener(async (resp) => {
    try {
      const data = (resp.notification.request.content.data ?? {}) as { taskId?: string };
      const taskId = data.taskId;
      if (!taskId) return;
      const actionId = resp.actionIdentifier;
      const deps = getDeps();
      if (!depsReady || !deps) {
        queuePending(taskId, actionId);
        return;
      }
      await applyAction(deps, taskId, actionId, onOpen);
    } catch {
      // Best-effort. Notification handlers must not throw.
    }
  });
  return () => {
    responseListener?.remove();
    responseListener = null;
  };
}

/**
 * Cold-start replay: when the user taps a notification while the app is
 * killed, `getLastNotificationResponseAsync` returns the response after
 * boot. Call this once deps are ready.
 */
export async function replayLastNotificationResponse(
  deps: MobileDeps,
  onOpen: (taskId: string) => void,
): Promise<void> {
  const resp = await Notifications.getLastNotificationResponseAsync();
  if (!resp) return;
  const data = (resp.notification.request.content.data ?? {}) as { taskId?: string };
  const taskId = data.taskId;
  if (!taskId) return;
  await applyAction(deps, taskId, resp.actionIdentifier, onOpen);
}

/**
 * Apply a reconcile diff to the scheduled set. Sequential — Expo's API
 * doesn't batch and we expect << 60 entries per cycle anyway.
 */
export async function applyReconcileResult(result: {
  toCancel: readonly string[];
  toSchedule: readonly TaskNotificationSpec[];
}): Promise<void> {
  for (const taskId of result.toCancel) {
    try { await cancelForTask(taskId); } catch { /* best-effort */ }
  }
  for (const spec of result.toSchedule) {
    try { await scheduleNotification(spec); } catch { /* best-effort */ }
  }
}
