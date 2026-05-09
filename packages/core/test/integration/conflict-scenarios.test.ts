import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeProject, makeTask, nowIso } from "../../src/index.js";
import {
  createTestUser, deleteTestUser, uniqueEmail,
} from "./helpers/supabase-test.js";
import { buildSignedInClient } from "./helpers/client.js";

const PASSWORD = "test-password-123";
let userId: string;
const email = uniqueEmail("concurrent");

beforeAll(async () => {
  userId = await createTestUser(email, PASSWORD);
});

afterAll(async () => {
  await deleteTestUser(userId);
});

describe("concurrent different-field updates", () => {
  it("both fields survive when two clients change different fields offline", async () => {
    const a = await buildSignedInClient(email, PASSWORD);
    const b = await buildSignedInClient(email, PASSWORD);

    // Client A creates a project and a task, syncs.
    const project = makeProject({ userId, name: "P" });
    await a.store.upsert("projects", project);
    await a.outbox.enqueue({
      entityTable: "projects", entityId: project.id, op: "insert",
      changedFields: serializeProject(project), clientTs: project.updatedAt,
    });
    const task = makeTask({ userId, projectId: project.id, title: "Original" });
    await a.store.upsert("tasks", task);
    await a.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "insert",
      changedFields: serializeTask(task), clientTs: task.updatedAt,
    });
    await a.engine.push();

    // Client B pulls.
    await b.engine.pull(null);
    const seen = await b.store.findById<any>("tasks", task.id);
    expect(seen?.title).toBe("Original");

    // Both go "offline": A changes title, B changes status. Different timestamps.
    const tsA = nowIso();
    await a.store.upsert("tasks", { ...task, title: "Changed by A", updatedAt: tsA });
    await a.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "update",
      changedFields: { title: "Changed by A" }, clientTs: tsA,
    });

    await new Promise((r) => setTimeout(r, 5));
    const tsB = nowIso();
    await b.store.upsert("tasks", { ...seen, status: "in_progress", updatedAt: tsB });
    await b.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "update",
      changedFields: { status: "in_progress" }, clientTs: tsB,
    });

    // Both come back online and push.
    await a.engine.push();
    await b.engine.push();

    // Both pull and converge.
    await a.engine.pull(null);
    await b.engine.pull(null);

    const finalA = await a.store.findById<any>("tasks", task.id);
    const finalB = await b.store.findById<any>("tasks", task.id);
    expect(finalA?.title).toBe("Changed by A");
    expect(finalA?.status).toBe("in_progress");
    expect(finalB?.title).toBe("Changed by A");
    expect(finalB?.status).toBe("in_progress");
  });
});

// helpers re-used below — consider promoting to helpers/ once tests grow.
function serializeProject(p: any) {
  return {
    id: p.id, name: p.name, color: p.color, archived: p.archived,
    sortOrder: p.sortOrder, createdAt: p.createdAt, updatedAt: p.updatedAt,
    deletedAt: p.deletedAt,
  };
}
function serializeTask(t: any) {
  return {
    id: t.id, projectId: t.projectId, parentTaskId: t.parentTaskId,
    title: t.title, description: t.description, status: t.status,
    priority: t.priority, dueDate: t.dueDate, completedAt: t.completedAt,
    sortOrder: t.sortOrder, recurrenceRule: t.recurrenceRule,
    recurrenceParentId: t.recurrenceParentId, createdAt: t.createdAt,
    updatedAt: t.updatedAt, deletedAt: t.deletedAt,
  };
}
