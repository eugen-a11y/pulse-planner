import { Notification, powerMonitor } from "electron";
import type { Task } from "@pulse/core";
import type { AppDeps } from "./deps.js";

export type FireFn = (task: Task) => void;

const HORIZON_MS = 24 * 3600 * 1000;
const MISSED_TOLERANCE_MS = 5 * 60 * 1000;

export class NotificationScheduler {
  private timers = new Map<string, NodeJS.Timeout>();
  constructor(private readonly fire: FireFn) {}

  reschedule(tasks: readonly Task[]): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();

    const now = Date.now();
    for (const task of tasks) {
      if (task.status === "done") continue;
      if (task.deletedAt) continue;
      if (!task.dueDate) continue;
      // Mirror mobile: a task only gets a notification when an explicit
      // reminderOffsetMinutes is set. null means "no reminder" — silent.
      if (task.reminderOffsetMinutes === null || task.reminderOffsetMinutes === undefined) continue;
      const dueMs = new Date(task.dueDate).getTime();
      if (!Number.isFinite(dueMs)) continue;
      const fireMs = dueMs - task.reminderOffsetMinutes * 60_000;
      const delta = fireMs - now;
      if (delta < -MISSED_TOLERANCE_MS) continue;
      if (delta > HORIZON_MS) continue;
      const delay = Math.max(0, delta);
      const timer = setTimeout(() => {
        this.timers.delete(task.id);
        this.fire(task);
      }, delay);
      this.timers.set(task.id, timer);
    }
  }

  cancel(taskId: string): void {
    const t = this.timers.get(taskId);
    if (t) { clearTimeout(t); this.timers.delete(taskId); }
  }

  cancelAll(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }
}

let scheduler: NotificationScheduler | null = null;

export function setupNotifications(deps: AppDeps, getWin: () => Electron.BrowserWindow | null): void {
  scheduler = new NotificationScheduler((task) => {
    const n = new Notification({
      title: task.title,
      body: task.dueDate ? new Date(task.dueDate).toLocaleString("de-DE") : "",
      silent: false,
    });
    n.on("click", () => {
      const win = getWin();
      win?.show();
      win?.webContents.send("nav.task", task.id);
    });
    n.show();
  });

  void rescheduleFromStore(deps);

  powerMonitor.on("resume", () => { void rescheduleFromStore(deps); });
}

export async function rescheduleFromStore(deps: AppDeps): Promise<void> {
  if (!scheduler || !deps.engine) return;
  const userId = (deps.engine as unknown as { deps: { userId: string } }).deps.userId;
  const tasks = await deps.store.listSince("tasks", null, { userId });
  scheduler.reschedule(tasks as unknown as Task[]);
}
