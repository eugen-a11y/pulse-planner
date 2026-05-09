import type { Command } from "commander";
import { makeProject } from "@pulse/core";
import { buildContext, restoreOrFail } from "../context.js";

export function registerProject(program: Command): void {
  const proj = program.command("project").description("Project commands");

  proj
    .command("create <name>")
    .option("--color <hex>", "color hex", "#2563eb")
    .action(async (name: string, opts: { color: string }) => {
      const ctx = buildContext();
      const { userId } = await restoreOrFail(ctx);
      const p = makeProject({ userId, name, color: opts.color });
      await ctx.store.upsert("projects", p);
      await ctx.outbox.enqueue({
        entityTable: "projects",
        entityId: p.id,
        op: "insert",
        changedFields: {
          id: p.id, name: p.name, color: p.color,
          archived: p.archived, sortOrder: p.sortOrder,
          createdAt: p.createdAt, updatedAt: p.updatedAt,
          deletedAt: p.deletedAt,
        },
        clientTs: p.updatedAt,
      });
      await ctx.engine.push();
      console.log("created project", p.id, p.name);
    });

  proj
    .command("list")
    .action(async () => {
      const ctx = buildContext();
      const { userId } = await restoreOrFail(ctx);
      await ctx.engine.pull(null);
      const rows = await ctx.store.listSince("projects", null, { userId });
      for (const r of rows) {
        console.log(`${r.id}  ${(r as any).name}`);
      }
    });
}
