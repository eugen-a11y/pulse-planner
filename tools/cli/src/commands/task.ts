import type { Command } from "commander";
import { makeTask, nowIso, type Task } from "@pulse/core";
import { buildContext, restoreOrFail } from "../context.js";

export function registerTask(program: Command): void {
  const t = program.command("task").description("Task commands");

  t.command("add")
    .requiredOption("--project <id>")
    .requiredOption("--title <title>")
    .option("--due <iso>", "ISO due date", "")
    .option("--priority <n>", "1-3", "2")
    .action(async (opts: { project: string; title: string; due: string; priority: string }) => {
      const ctx = buildContext();
      const { userId } = await restoreOrFail(ctx);
      const task = makeTask({
        userId,
        projectId: opts.project,
        title: opts.title,
        dueDate: opts.due ? opts.due : null,
        priority: Math.min(3, Math.max(1, parseInt(opts.priority, 10))) as 1 | 2 | 3,
      });
      await ctx.store.upsert("tasks", task);
      await ctx.outbox.enqueue({
        entityTable: "tasks",
        entityId: task.id,
        op: "insert",
        changedFields: serializeTask(task),
        clientTs: task.updatedAt,
      });
      await ctx.engine.push();
      console.log("created task", task.id, task.title);
    });

  t.command("list")
    .option("--project <id>")
    .action(async (opts: { project?: string }) => {
      const ctx = buildContext();
      const { userId } = await restoreOrFail(ctx);
      await ctx.engine.pull(null);
      const rows = await ctx.store.listSince<any>("tasks", null, { userId });
      const filtered = opts.project ? rows.filter((r) => r.projectId === opts.project) : rows;
      for (const r of filtered) {
        console.log(`${r.id}  [${r.status}] ${r.title}`);
      }
    });

  t.command("done <taskId>")
    .action(async (taskId: string) => {
      const ctx = buildContext();
      await restoreOrFail(ctx);
      await ctx.engine.pull(null);
      const local = await ctx.store.findById<any>("tasks", taskId);
      if (!local) throw new Error("task not found locally; pull may have missed it");
      const ts = nowIso();
      const updated = { ...local, status: "done", completedAt: ts, updatedAt: ts };
      await ctx.store.upsert("tasks", updated);
      await ctx.outbox.enqueue({
        entityTable: "tasks", entityId: taskId, op: "update",
        changedFields: { status: "done", completedAt: ts },
        clientTs: ts,
      });
      await ctx.engine.push();
      console.log("done", taskId);
    });
}

function serializeTask(t: Task): Record<string, unknown> {
  return {
    id: t.id,
    projectId: t.projectId,
    parentTaskId: t.parentTaskId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    completedAt: t.completedAt,
    sortOrder: t.sortOrder,
    recurrenceRule: t.recurrenceRule,
    recurrenceParentId: t.recurrenceParentId,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    deletedAt: t.deletedAt,
  };
}
