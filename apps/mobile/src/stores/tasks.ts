import { create } from "zustand";
import { rrulestr } from "rrule";
import { makeTask, nowIso, type Task, type Project } from "@pulse/core";
import type { MobileDeps } from "@/wiring/deps";
import { reconcileNotificationsDebounced } from "@/notifications";
import { buildTodaySnapshot, writeSnapshot } from "@/platform/WidgetData";

/**
 * Write the iOS Today widget snapshot. Best-effort: any failure is swallowed
 * inside writeSnapshot() (logs to console.warn) so widget IO never crashes a
 * store action. Reads from raw `deps.store` rather than the in-memory zustand
 * `byId` so it stays accurate for the inbox/upcoming code paths that don't
 * touch `todayIds`.
 */
async function emitWidgetSnapshot(d: MobileDeps): Promise<void> {
  if (!d.userId) return;
  try {
    const [tasks, projects] = await Promise.all([
      d.store.listSince<Task>("tasks", null, { userId: d.userId }),
      d.store.listSince<Project>("projects", null, { userId: d.userId }),
    ]);
    const snap = buildTodaySnapshot({
      now: new Date(),
      tasks: tasks.map((t) => ({
        id: t.id, title: t.title, dueDate: t.dueDate,
        status: t.status, deletedAt: t.deletedAt, projectId: t.projectId,
      })),
      projects: projects.map((p) => ({ id: p.id, color: p.color })),
    });
    await writeSnapshot(snap);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[tasks] emitWidgetSnapshot failed:", (e as Error).message);
  }
}

/** Exposed so app/_layout can fire-and-forget the widget write after a pull. */
export async function emitWidgetSnapshotFor(d: MobileDeps): Promise<void> {
  return emitWidgetSnapshot(d);
}

/**
 * Mobile tasks store. Mirrors `apps/desktop/src/renderer/stores/tasks.ts`
 * action surface; implementation mirrors `apps/desktop/src/main/ipc.ts` tasks.*
 * handlers (including recurrence-spawn in `complete`).
 */
let _deps: MobileDeps | null = null;
export function bindDeps(d: MobileDeps): void { _deps = d; }
function deps(): MobileDeps {
  if (!_deps) throw new Error("tasks store: bindDeps() not called");
  return _deps;
}
function requireUserId(): string {
  const d = deps();
  if (!d.userId) throw new Error("not signed in");
  return d.userId;
}

function indexBy(list: Task[]): Record<string, Task> {
  const out: Record<string, Task> = {};
  for (const t of list) out[t.id] = t;
  return out;
}

function serializeTaskForOutbox(t: Task): Record<string, unknown> {
  return {
    id: t.id, projectId: t.projectId, parentTaskId: t.parentTaskId,
    title: t.title, description: t.description, status: t.status,
    priority: t.priority, dueDate: t.dueDate, completedAt: t.completedAt,
    sortOrder: t.sortOrder, recurrenceRule: t.recurrenceRule,
    recurrenceParentId: t.recurrenceParentId, createdAt: t.createdAt,
    updatedAt: t.updatedAt, deletedAt: t.deletedAt,
  };
}

interface TasksState {
  byId: Record<string, Task>;
  todayIds: string[];
  upcomingIds: string[];
  inboxIds: string[];
  byProject: Record<string, string[]>;
  loaded: boolean;
  refreshToday: () => Promise<void>;
  refreshUpcoming: () => Promise<void>;
  refreshInbox: () => Promise<void>;
  refreshProject: (projectId: string) => Promise<void>;
  create: (input: {
    projectId: string | null; title: string;
    dueDate?: string | null; priority?: 1 | 2 | 3 | 4;
    parentTaskId?: string | null; description?: string | null;
  }) => Promise<Task>;
  update: (id: string, fields: Partial<Task>) => Promise<void>;
  complete: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useTasks = create<TasksState>((set, get) => ({
  byId: {},
  todayIds: [],
  upcomingIds: [],
  inboxIds: [],
  byProject: {},
  loaded: false,

  async refreshToday() {
    const d = deps();
    const userId = requireUserId();
    const all = await d.store.listSince<Task>("tasks", null, { userId });
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const cutoff = todayEnd.toISOString();
    const list = all.filter((t) =>
      t.status !== "done" && t.dueDate !== null && t.dueDate <= cutoff,
    );
    set((s) => ({
      byId: { ...s.byId, ...indexBy(list) },
      todayIds: list.map((t) => t.id),
      loaded: true,
    }));
    reconcileNotificationsDebounced();
    void emitWidgetSnapshot(d);
  },

  async refreshUpcoming() {
    const d = deps();
    const userId = requireUserId();
    const all = await d.store.listSince<Task>("tasks", null, { userId });
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const sevenDays = new Date(); sevenDays.setDate(sevenDays.getDate() + 7);
    const startCutoff = todayEnd.toISOString();
    const endCutoff = sevenDays.toISOString();
    const list = all.filter((t) =>
      t.status !== "done" && t.dueDate !== null &&
      t.dueDate > startCutoff && t.dueDate <= endCutoff,
    );
    set((s) => ({
      byId: { ...s.byId, ...indexBy(list) },
      upcomingIds: list.map((t) => t.id),
      loaded: true,
    }));
    reconcileNotificationsDebounced();
  },

  async refreshInbox() {
    const d = deps();
    const userId = requireUserId();
    const all = await d.store.listSince<Task>("tasks", null, { userId });
    const list = all.filter((t) => t.projectId === null);
    set((s) => ({
      byId: { ...s.byId, ...indexBy(list) },
      inboxIds: list.map((t) => t.id),
      loaded: true,
    }));
    reconcileNotificationsDebounced();
  },

  async refreshProject(projectId) {
    const d = deps();
    const userId = requireUserId();
    const all = await d.store.listSince<Task>("tasks", null, { userId });
    const list = all.filter((t) => t.projectId === projectId);
    set((s) => ({
      byId: { ...s.byId, ...indexBy(list) },
      byProject: { ...s.byProject, [projectId]: list.map((t) => t.id) },
      loaded: true,
    }));
    reconcileNotificationsDebounced();
  },

  async create(input) {
    const d = deps();
    const userId = requireUserId();
    const t = makeTask({ userId, ...input });
    await d.store.upsert("tasks", t);
    await d.outbox.enqueue({
      entityTable: "tasks", entityId: t.id, op: "insert",
      changedFields: serializeTaskForOutbox(t),
      clientTs: t.updatedAt,
    });
    if (input.projectId) await get().refreshProject(input.projectId);
    else await get().refreshInbox();
    void emitWidgetSnapshot(d);
    return t;
  },

  async update(id, fields) {
    const d = deps();
    const userId = requireUserId();
    const local = await d.store.findById<Task>("tasks", id);
    if (!local || local.userId !== userId) throw new Error("task not found");
    const ts = nowIso();
    const updated: Task = { ...local, ...fields, updatedAt: ts };
    await d.store.upsert("tasks", updated);
    const { id: _i, userId: _u, createdAt: _c, ...rest } = fields;
    void _i; void _u; void _c;
    await d.outbox.enqueue({
      entityTable: "tasks", entityId: id, op: "update",
      changedFields: { ...rest, updatedAt: ts },
      clientTs: ts,
    });
    if (updated.projectId) await get().refreshProject(updated.projectId);
    else await get().refreshInbox();
    await get().refreshToday();
  },

  async complete(id) {
    const d = deps();
    const userId = requireUserId();
    const local = await d.store.findById<Task>("tasks", id);
    if (!local || local.userId !== userId) throw new Error("task not found");
    const ts = nowIso();
    const updated: Task = { ...local, status: "done", completedAt: ts, updatedAt: ts };
    await d.store.upsert("tasks", updated);
    await d.outbox.enqueue({
      entityTable: "tasks", entityId: id, op: "update",
      changedFields: { status: "done", completedAt: ts, updatedAt: ts },
      clientTs: ts,
    });
    // Recurrence: if the completed task carries an RRULE, spawn the next occurrence.
    // Mirror ipc.ts lines 256-312.
    if (local.recurrenceRule && local.recurrenceRule.trim()) {
      try {
        const baseDate = local.dueDate ? new Date(local.dueDate) : new Date();
        const dtstart = baseDate.toISOString().replace(/[-:]|\.\d{3}/g, "");
        const rule = rrulestr(`DTSTART:${dtstart}\nRRULE:${local.recurrenceRule.trim()}`);
        const next = rule.after(baseDate, false);
        if (next) {
          const child = makeTask({
            userId,
            projectId: local.projectId,
            title: local.title,
            description: local.description,
            priority: local.priority as 1 | 2 | 3 | 4,
            dueDate: next.toISOString(),
            parentTaskId: local.parentTaskId,
            recurrenceRule: local.recurrenceRule,
            recurrenceParentId: local.recurrenceParentId ?? local.id,
            sortOrder: local.sortOrder,
          });
          await d.store.upsert("tasks", child);
          await d.outbox.enqueue({
            entityTable: "tasks", entityId: child.id, op: "insert",
            changedFields: serializeTaskForOutbox(child),
            clientTs: child.updatedAt,
          });
        }
      } catch {
        // Silent — desktop logs to userData boot-trace; mobile has no equivalent yet.
      }
    }
    if (updated.projectId) await get().refreshProject(updated.projectId);
    else await get().refreshInbox();
    await get().refreshToday();
  },

  async remove(id) {
    const d = deps();
    requireUserId();
    const local = await d.store.findById<Task>("tasks", id);
    const ts = nowIso();
    await d.store.softDelete("tasks", id, ts);
    await d.outbox.enqueue({
      entityTable: "tasks", entityId: id, op: "delete",
      changedFields: {}, clientTs: ts,
    });
    if (local?.projectId) await get().refreshProject(local.projectId);
    else await get().refreshInbox();
    await get().refreshToday();
  },
}));
