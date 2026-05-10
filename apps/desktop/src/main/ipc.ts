import { ipcMain, type BrowserWindow } from "electron";
import {
  makeProject, makeTask, makeTag, makeTaskTag, nowIso,
  type Project, type Task, type Tag,
} from "@pulse/core";
import type { AppDeps } from "./deps.js";
import { broadcast, pushAfterMutation, requireUser } from "./ipc-helpers.js";

export function registerIpc(deps: AppDeps, getWin: () => BrowserWindow | null): void {
  // ─── auth ───
  ipcMain.handle("auth.signIn", async (_e, email: string, password: string) => {
    const session = await deps.auth.signIn(email, password);
    deps.setUserId(session.user.id);
    return session;
  });
  ipcMain.handle("auth.signUp", async (_e, email: string, password: string) => {
    const session = await deps.auth.signUp(email, password);
    deps.setUserId(session.user.id);
    return session;
  });
  ipcMain.handle("auth.signOut", async () => {
    await deps.auth.signOut();
    deps.engine = null;
  });
  ipcMain.handle("auth.restoreSession", async () => {
    const session = await deps.auth.restoreSession();
    if (session) deps.setUserId(session.user.id);
    return session;
  });

  // ─── projects ───
  ipcMain.handle("projects.list", async () => {
    const userId = requireUser(deps);
    return deps.store.listSince<Project>("projects", null, { userId });
  });
  ipcMain.handle("projects.create", async (_e, input: { name: string; color?: string }) => {
    const userId = requireUser(deps);
    const p = makeProject({ userId, name: input.name, ...(input.color !== undefined ? { color: input.color } : {}) });
    await deps.store.upsert("projects", p);
    await deps.outbox.enqueue({
      entityTable: "projects", entityId: p.id, op: "insert",
      changedFields: {
        id: p.id, name: p.name, color: p.color,
        archived: p.archived, sortOrder: p.sortOrder,
        createdAt: p.createdAt, updatedAt: p.updatedAt, deletedAt: p.deletedAt,
      },
      clientTs: p.updatedAt,
    });
    broadcast(getWin(), "projects.changed");
    void pushAfterMutation(deps);
    return p;
  });
  ipcMain.handle("projects.update", async (_e, id: string, fields: Partial<Project>) => {
    const userId = requireUser(deps);
    const local = await deps.store.findById<Project>("projects", id);
    if (!local || local.userId !== userId) throw new Error("project not found");
    const ts = nowIso();
    const updated: Project = { ...local, ...fields, updatedAt: ts };
    await deps.store.upsert("projects", updated);
    const { id: _i, userId: _u, createdAt: _c, ...changedFields } = fields;
    await deps.outbox.enqueue({
      entityTable: "projects", entityId: id, op: "update",
      changedFields: { ...changedFields, updatedAt: ts },
      clientTs: ts,
    });
    broadcast(getWin(), "projects.changed");
    void pushAfterMutation(deps);
    return updated;
  });
  ipcMain.handle("projects.delete", async (_e, id: string) => {
    requireUser(deps);
    const ts = nowIso();
    await deps.store.softDelete("projects", id, ts);
    await deps.outbox.enqueue({
      entityTable: "projects", entityId: id, op: "delete",
      changedFields: {}, clientTs: ts,
    });
    broadcast(getWin(), "projects.changed");
    void pushAfterMutation(deps);
  });

  // ─── tasks ───
  ipcMain.handle("tasks.list", async (_e, filter: { projectId?: string }) => {
    const userId = requireUser(deps);
    const all = await deps.store.listSince<Task>("tasks", null, { userId });
    return filter.projectId ? all.filter((t) => t.projectId === filter.projectId) : all;
  });

  ipcMain.handle("tasks.listToday", async () => {
    const userId = requireUser(deps);
    const all = await deps.store.listSince<Task>("tasks", null, { userId });
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const cutoff = todayEnd.toISOString();
    return all.filter((t) => t.status !== "done" && t.dueDate !== null && t.dueDate <= cutoff);
  });

  ipcMain.handle("tasks.listUpcoming", async () => {
    const userId = requireUser(deps);
    const all = await deps.store.listSince<Task>("tasks", null, { userId });
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const sevenDays = new Date(); sevenDays.setDate(sevenDays.getDate() + 7);
    const startCutoff = todayEnd.toISOString();
    const endCutoff = sevenDays.toISOString();
    return all.filter((t) =>
      t.status !== "done" && t.dueDate !== null &&
      t.dueDate > startCutoff && t.dueDate <= endCutoff,
    );
  });

  ipcMain.handle("tasks.create", async (_e, input: {
    projectId: string; title: string;
    dueDate?: string | null; priority?: 1 | 2 | 3 | 4;
    parentTaskId?: string | null; description?: string | null;
  }) => {
    const userId = requireUser(deps);
    const t = makeTask({ userId, ...input });
    await deps.store.upsert("tasks", t);
    await deps.outbox.enqueue({
      entityTable: "tasks", entityId: t.id, op: "insert",
      changedFields: serializeTaskForOutbox(t),
      clientTs: t.updatedAt,
    });
    broadcast(getWin(), "tasks.changed");
    void pushAfterMutation(deps);
    return t;
  });

  ipcMain.handle("tasks.update", async (_e, id: string, fields: Partial<Task>) => {
    const userId = requireUser(deps);
    const local = await deps.store.findById<Task>("tasks", id);
    if (!local || local.userId !== userId) throw new Error("task not found");
    const ts = nowIso();
    const updated: Task = { ...local, ...fields, updatedAt: ts };
    await deps.store.upsert("tasks", updated);
    const { id: _i, userId: _u, createdAt: _c, ...rest } = fields;
    await deps.outbox.enqueue({
      entityTable: "tasks", entityId: id, op: "update",
      changedFields: { ...rest, updatedAt: ts },
      clientTs: ts,
    });
    broadcast(getWin(), "tasks.changed");
    void pushAfterMutation(deps);
    return updated;
  });

  ipcMain.handle("tasks.delete", async (_e, id: string) => {
    requireUser(deps);
    const ts = nowIso();
    await deps.store.softDelete("tasks", id, ts);
    await deps.outbox.enqueue({
      entityTable: "tasks", entityId: id, op: "delete",
      changedFields: {}, clientTs: ts,
    });
    broadcast(getWin(), "tasks.changed");
    void pushAfterMutation(deps);
  });

  ipcMain.handle("tasks.complete", async (_e, id: string) => {
    const userId = requireUser(deps);
    const local = await deps.store.findById<Task>("tasks", id);
    if (!local || local.userId !== userId) throw new Error("task not found");
    const ts = nowIso();
    const updated: Task = { ...local, status: "done", completedAt: ts, updatedAt: ts };
    await deps.store.upsert("tasks", updated);
    await deps.outbox.enqueue({
      entityTable: "tasks", entityId: id, op: "update",
      changedFields: { status: "done", completedAt: ts, updatedAt: ts },
      clientTs: ts,
    });
    broadcast(getWin(), "tasks.changed");
    void pushAfterMutation(deps);
    return updated;
  });

  // ─── tags ───
  ipcMain.handle("tags.list", async () => {
    const userId = requireUser(deps);
    return deps.store.listSince<Tag>("tags", null, { userId });
  });
  ipcMain.handle("tags.create", async (_e, input: { name: string; color?: string }) => {
    const userId = requireUser(deps);
    const tag = makeTag({ userId, name: input.name, ...(input.color !== undefined ? { color: input.color } : {}) });
    await deps.store.upsert("tags", tag);
    await deps.outbox.enqueue({
      entityTable: "tags", entityId: tag.id, op: "insert",
      changedFields: {
        id: tag.id, name: tag.name, color: tag.color,
        createdAt: tag.createdAt, updatedAt: tag.updatedAt, deletedAt: tag.deletedAt,
      },
      clientTs: tag.updatedAt,
    });
    broadcast(getWin(), "tags.changed");
    void pushAfterMutation(deps);
    return tag;
  });
  ipcMain.handle("tags.attach", async (_e, taskId: string, tagId: string) => {
    const userId = requireUser(deps);
    const tt = makeTaskTag({ userId, taskId, tagId });
    await deps.store.upsert("task_tags", tt as any);
    await deps.outbox.enqueue({
      entityTable: "task_tags", entityId: taskId + ":" + tagId, op: "insert",
      changedFields: { task_id: taskId, tag_id: tagId, user_id: userId, created_at: tt.createdAt },
      clientTs: tt.createdAt,
    });
    broadcast(getWin(), "tags.changed");
    void pushAfterMutation(deps);
  });
  ipcMain.handle("tags.detach", async (_e, taskId: string, tagId: string) => {
    requireUser(deps);
    deps.db.prepare("DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?").run(taskId, tagId);
    // task_tags has no soft-delete + no updated_at; for v1 we rely on realtime sync.
    broadcast(getWin(), "tags.changed");
  });

  // ─── sync (placeholders, fleshed out later) ───
  ipcMain.handle("sync.pushNow", async () => { await pushAfterMutation(deps); });
  ipcMain.handle("sync.pullNow", async () => { if (deps.engine) await deps.engine.pull(); });

  // ─── time_entries ───
  ipcMain.handle("time_entries.listForTask", async (_e, taskId: string) => {
    const userId = requireUser(deps);
    const all = await deps.store.listSince("time_entries", null, { userId });
    return (all as any[]).filter((e) => e.taskId === taskId).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  });
  ipcMain.handle("time_entries.start", async (_e, taskId: string) => {
    if (!deps.timer) throw new Error("not signed in");
    const entry = await deps.timer.start(taskId);
    broadcast(getWin(), "timer.current", deps.timer.current());
    void pushAfterMutation(deps);
    return entry;
  });
  ipcMain.handle("time_entries.stop", async () => {
    if (!deps.timer) return null;
    const entry = await deps.timer.stop();
    broadcast(getWin(), "timer.current", deps.timer.current());
    void pushAfterMutation(deps);
    return entry;
  });

  // ─── timer state read ───
  ipcMain.handle("timer.current", async () => {
    return deps.timer?.current() ?? null;
  });
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
