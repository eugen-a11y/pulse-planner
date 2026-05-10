import { ipcMain, shell, app, type BrowserWindow } from "electron";
import {
  makeProject, makeTask, makeTag, makeTaskTag, nowIso,
  type Project, type Task, type Tag,
} from "@pulse/core";
import type { AppDeps } from "./deps.js";
import { broadcast, pushAfterMutation, pushSyncStatus, requireUser } from "./ipc-helpers.js";

async function tasksChanged(deps: AppDeps, getWin: () => BrowserWindow | null): Promise<void> {
  broadcast(getWin(), "tasks.changed");
  const { rescheduleFromStore } = await import("./notifications.js");
  void rescheduleFromStore(deps);
}

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
        dueDate: p.dueDate, description: p.description,
        createdAt: p.createdAt, updatedAt: p.updatedAt, deletedAt: p.deletedAt,
      },
      clientTs: p.updatedAt,
    });
    broadcast(getWin(), "projects.changed");
    void pushAfterMutation(deps, getWin);
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
    void pushAfterMutation(deps, getWin);
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
    void pushAfterMutation(deps, getWin);
  });

  // ─── tasks ───
  ipcMain.handle("tasks.list", async (_e, filter: { projectId?: string }) => {
    const userId = requireUser(deps);
    const all = await deps.store.listSince<Task>("tasks", null, { userId });
    return filter.projectId ? all.filter((t) => t.projectId === filter.projectId) : all;
  });

  ipcMain.handle("tasks.listInbox", async () => {
    const userId = requireUser(deps);
    const all = await deps.store.listSince<Task>("tasks", null, { userId });
    return all.filter((t) => t.projectId === null);
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
    projectId: string | null; title: string;
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
    void tasksChanged(deps, getWin);
    void pushAfterMutation(deps, getWin);
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
    void tasksChanged(deps, getWin);
    void pushAfterMutation(deps, getWin);
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
    void tasksChanged(deps, getWin);
    void pushAfterMutation(deps, getWin);
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
    void tasksChanged(deps, getWin);
    void pushAfterMutation(deps, getWin);
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
    void pushAfterMutation(deps, getWin);
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
    void pushAfterMutation(deps, getWin);
  });
  ipcMain.handle("tags.detach", async (_e, taskId: string, tagId: string) => {
    requireUser(deps);
    deps.db.prepare("DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?").run(taskId, tagId);
    // task_tags has no soft-delete + no updated_at; for v1 we rely on realtime sync.
    broadcast(getWin(), "tags.changed");
  });

  // ─── sync ───
  ipcMain.handle("sync.pushNow", async () => { await pushAfterMutation(deps, getWin); });
  ipcMain.handle("sync.pullNow", async () => {
    if (!deps.engine) return;
    try {
      await deps.engine.pull();
      await pushSyncStatus(deps, getWin, { lastPullAt: nowIso() });
    } catch (e) {
      if (/401|unauthor|jwt/i.test((e as Error).message)) {
        await deps.auth.signOut();
        deps.engine = null;
        getWin()?.webContents.send("auth.expired", null);
      }
      await pushSyncStatus(deps, getWin);
    }
  });

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
    void pushAfterMutation(deps, getWin);
    return entry;
  });
  ipcMain.handle("time_entries.stop", async () => {
    if (!deps.timer) return null;
    const entry = await deps.timer.stop();
    broadcast(getWin(), "timer.current", deps.timer.current());
    void pushAfterMutation(deps, getWin);
    return entry;
  });

  // ─── timer state read ───
  ipcMain.handle("timer.current", async () => {
    return deps.timer?.current() ?? null;
  });

  // ─── notes ───
  ipcMain.handle("notes.listForTask", async (_e, taskId: string) => {
    const userId = requireUser(deps);
    const all = await deps.store.listSince("notes", null, { userId });
    return (all as any[]).filter((n) => n.taskId === taskId);
  });
  ipcMain.handle("notes.listForProject", async (_e, projectId: string) => {
    const userId = requireUser(deps);
    const all = await deps.store.listSince("notes", null, { userId });
    return (all as any[]).filter((n) => n.projectId === projectId);
  });
  ipcMain.handle("notes.create", async (_e, input: { projectId?: string; taskId?: string; bodyMd: string }) => {
    const userId = requireUser(deps);
    const { makeProjectNote, makeTaskNote } = await import("@pulse/core");
    const note = input.taskId
      ? makeTaskNote({ userId, taskId: input.taskId, bodyMd: input.bodyMd })
      : makeProjectNote({ userId, projectId: input.projectId!, bodyMd: input.bodyMd });
    await deps.store.upsert("notes", note as any);
    await deps.outbox.enqueue({
      entityTable: "notes", entityId: note.id, op: "insert",
      changedFields: {
        id: note.id, projectId: note.projectId, taskId: note.taskId, bodyMd: note.bodyMd,
        createdAt: note.createdAt, updatedAt: note.updatedAt, deletedAt: note.deletedAt,
      },
      clientTs: note.updatedAt,
    });
    void pushAfterMutation(deps, getWin);
    return note;
  });
  ipcMain.handle("notes.update", async (_e, id: string, fields: { bodyMd: string }) => {
    requireUser(deps);
    const local = await deps.store.findById<any>("notes", id);
    if (!local) throw new Error("note not found");
    const ts = nowIso();
    const updated = { ...local, ...fields, updatedAt: ts };
    await deps.store.upsert("notes", updated);
    await deps.outbox.enqueue({
      entityTable: "notes", entityId: id, op: "update",
      changedFields: { bodyMd: fields.bodyMd, updatedAt: ts },
      clientTs: ts,
    });
    void pushAfterMutation(deps, getWin);
    return updated;
  });
  ipcMain.handle("notes.delete", async (_e, id: string) => {
    requireUser(deps);
    const ts = nowIso();
    await deps.store.softDelete("notes", id, ts);
    await deps.outbox.enqueue({ entityTable: "notes", entityId: id, op: "delete", changedFields: {}, clientTs: ts });
    void pushAfterMutation(deps, getWin);
  });

  // ─── comments ───
  ipcMain.handle("comments.listForTask", async (_e, taskId: string) => {
    const userId = requireUser(deps);
    const all = await deps.store.listSince("comments", null, { userId });
    return (all as any[]).filter((c) => c.taskId === taskId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });
  ipcMain.handle("comments.create", async (_e, input: { taskId: string; bodyMd: string }) => {
    const userId = requireUser(deps);
    const { makeComment } = await import("@pulse/core");
    const c = makeComment({ userId, taskId: input.taskId, bodyMd: input.bodyMd });
    await deps.store.upsert("comments", c);
    await deps.outbox.enqueue({
      entityTable: "comments", entityId: c.id, op: "insert",
      changedFields: { id: c.id, taskId: c.taskId, bodyMd: c.bodyMd, createdAt: c.createdAt, updatedAt: c.updatedAt, deletedAt: c.deletedAt },
      clientTs: c.updatedAt,
    });
    void pushAfterMutation(deps, getWin);
    return c;
  });
  ipcMain.handle("comments.update", async (_e, id: string, fields: { bodyMd: string }) => {
    requireUser(deps);
    const local = await deps.store.findById<any>("comments", id);
    if (!local) throw new Error("comment not found");
    const ts = nowIso();
    const updated = { ...local, ...fields, updatedAt: ts };
    await deps.store.upsert("comments", updated);
    await deps.outbox.enqueue({ entityTable: "comments", entityId: id, op: "update", changedFields: { bodyMd: fields.bodyMd, updatedAt: ts }, clientTs: ts });
    void pushAfterMutation(deps, getWin);
    return updated;
  });
  ipcMain.handle("comments.delete", async (_e, id: string) => {
    requireUser(deps);
    const ts = nowIso();
    await deps.store.softDelete("comments", id, ts);
    await deps.outbox.enqueue({ entityTable: "comments", entityId: id, op: "delete", changedFields: {}, clientTs: ts });
    void pushAfterMutation(deps, getWin);
  });

  // ─── quick-add ───
  ipcMain.on("quickAdd.show", () => {
    void import("./window.js").then(({ showQuickAddWindow }) => showQuickAddWindow());
  });
  ipcMain.handle("quickAdd.parse", async (_e, text: string) => {
    const userId = requireUser(deps);
    const projects = await deps.store.listSince("projects", null, { userId });
    const refs = (projects as any[]).map((p) => ({ id: p.id, name: p.name }));
    const { parseQuickAddText } = await import("../renderer/lib/quick-add-parser.js");
    return parseQuickAddText(text, refs);
  });
  ipcMain.handle("quickAdd.submit", async (_e, parsed: { title: string; projectId: string | null; dueDate: string | null; priority: 1|2|3|4; tagNames: string[] }) => {
    const userId = requireUser(deps);
    // No @projekt → projectId stays null → task lands in Inbox.
    const t = makeTask({
      userId, projectId: parsed.projectId, title: parsed.title,
      dueDate: parsed.dueDate, priority: parsed.priority,
    });
    await deps.store.upsert("tasks", t);
    await deps.outbox.enqueue({
      entityTable: "tasks", entityId: t.id, op: "insert",
      changedFields: serializeTaskForOutbox(t), clientTs: t.updatedAt,
    });
    void tasksChanged(deps, getWin);
    void pushAfterMutation(deps, getWin);
    void import("./window.js").then(({ hideQuickAdd }) => hideQuickAdd());
    return t;
  });

  // ─── notifications ───
  ipcMain.handle("notifications.snooze", async (_e, taskId: string, minutes: number) => {
    const local = await deps.store.findById<Task>("tasks", taskId);
    if (!local || !local.dueDate) return;
    const next = new Date(new Date(local.dueDate).getTime() + minutes * 60_000).toISOString();
    const ts = nowIso();
    const updated: Task = { ...local, dueDate: next, updatedAt: ts };
    await deps.store.upsert("tasks", updated);
    await deps.outbox.enqueue({
      entityTable: "tasks", entityId: taskId, op: "update",
      changedFields: { dueDate: next, updatedAt: ts }, clientTs: ts,
    });
    void tasksChanged(deps, getWin);
    void pushAfterMutation(deps, getWin);
    const { rescheduleFromStore } = await import("./notifications.js");
    void rescheduleFromStore(deps);
  });

  // ─── tray ───
  ipcMain.handle("tray.setCount", async (_e, n: number) => {
    const { updateTrayCount } = await import("./tray.js");
    updateTrayCount(n);
  });

  // ─── updater ───
  ipcMain.handle("updater.check", async () => {
    const { getUpdater } = await import("./updater-ref.js");
    return await getUpdater()?.check() ?? null;
  });
  ipcMain.on("updater.installAndRestart", async () => {
    const { getUpdater } = await import("./updater-ref.js");
    getUpdater()?.installAndRestart();
  });

  // ─── attachments ───
  ipcMain.handle("attachments.listForTask", async (_e, taskId: string) => {
    const userId = requireUser(deps);
    const all = await deps.store.listSince("attachments", null, { userId });
    return (all as any[]).filter((a) => a.taskId === taskId);
  });
  ipcMain.handle("attachments.upload", async (_e, input: { taskId: string; localPath: string }) => {
    const userId = requireUser(deps);
    const { makeAttachment } = await import("@pulse/core");
    const { readFileSync, statSync } = await import("node:fs");
    const { basename } = await import("node:path");
    const fileBytes = readFileSync(input.localPath);
    const stat = statSync(input.localPath);
    const filename = basename(input.localPath);
    const mime = guessMime(filename);
    // Path is RELATIVE to the bucket. Storage RLS expects (foldername(name))[1]
    // to equal auth.uid()::text — so the first folder must be the user_id.
    // (Don't prefix with "attachments/" — that's the bucket name, already implied by .from("attachments").)
    const storagePath = `${userId}/${input.taskId}/${Date.now()}-${filename}`;
    const { error } = await deps.supabase.storage.from("attachments").upload(storagePath, fileBytes, { contentType: mime, upsert: false });
    if (error) throw new Error(`upload failed: ${error.message}`);
    const att = makeAttachment({
      userId, taskId: input.taskId, storagePath, filename, mime, sizeBytes: stat.size,
    });
    await deps.store.upsert("attachments", att);
    await deps.outbox.enqueue({
      entityTable: "attachments", entityId: att.id, op: "insert",
      changedFields: {
        id: att.id, taskId: att.taskId, storagePath: att.storagePath, filename: att.filename,
        mime: att.mime, sizeBytes: att.sizeBytes,
        createdAt: att.createdAt, updatedAt: att.updatedAt, deletedAt: att.deletedAt,
      },
      clientTs: att.updatedAt,
    });
    void pushAfterMutation(deps, getWin);
    return att;
  });
  ipcMain.handle("attachments.openLocally", async (_e, id: string) => {
    requireUser(deps);
    const att = await deps.store.findById<any>("attachments", id);
    if (!att?.storagePath) throw new Error("attachment not found");
    const { data, error } = await deps.supabase.storage.from("attachments").download(att.storagePath);
    if (error || !data) throw new Error(`download failed: ${error?.message ?? "no data"}`);
    const { writeFileSync, existsSync, mkdirSync } = await import("node:fs");
    const { join, basename } = await import("node:path");
    const cacheDir = join(app.getPath("temp"), "pulse-attachments", id);
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    const localFile = join(cacheDir, basename(att.filename));
    writeFileSync(localFile, Buffer.from(await data.arrayBuffer()));
    const result = await shell.openPath(localFile);
    if (result) throw new Error(`could not open: ${result}`);
  });
  ipcMain.handle("attachments.delete", async (_e, id: string) => {
    requireUser(deps);
    const local = await deps.store.findById<any>("attachments", id);
    if (local?.storagePath) {
      await deps.supabase.storage.from("attachments").remove([local.storagePath]);
    }
    const ts = nowIso();
    await deps.store.softDelete("attachments", id, ts);
    await deps.outbox.enqueue({ entityTable: "attachments", entityId: id, op: "delete", changedFields: {}, clientTs: ts });
    void pushAfterMutation(deps, getWin);
  });
}

function guessMime(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
    pdf: "application/pdf", txt: "text/plain", md: "text/markdown",
    json: "application/json", csv: "text/csv",
  };
  return ext ? (map[ext] ?? "application/octet-stream") : "application/octet-stream";
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
