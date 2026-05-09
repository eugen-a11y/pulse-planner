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

describe("same-field conflict", () => {
  it("later client_ts wins when both clients change the same field", async () => {
    const a = await buildSignedInClient(email, PASSWORD);
    const b = await buildSignedInClient(email, PASSWORD);

    const project = makeProject({ userId, name: "PX" });
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
    await b.engine.pull(null);

    const tsA = nowIso();
    await a.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "update",
      changedFields: { title: "From A" }, clientTs: tsA,
    });
    await new Promise((r) => setTimeout(r, 10));
    const tsB = nowIso();
    await b.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "update",
      changedFields: { title: "From B" }, clientTs: tsB,
    });

    await a.engine.push();
    await b.engine.push();
    await a.engine.pull(null);
    await b.engine.pull(null);

    const finalA = await a.store.findById<any>("tasks", task.id);
    const finalB = await b.store.findById<any>("tasks", task.id);
    expect(finalA?.title).toBe("From B");
    expect(finalB?.title).toBe("From B");
  });
});

describe("delete vs update", () => {
  it("delete with later ts wins over earlier update", async () => {
    const a = await buildSignedInClient(email, PASSWORD);
    const b = await buildSignedInClient(email, PASSWORD);

    const project = makeProject({ userId, name: "PD" });
    await a.store.upsert("projects", project);
    await a.outbox.enqueue({
      entityTable: "projects", entityId: project.id, op: "insert",
      changedFields: serializeProject(project), clientTs: project.updatedAt,
    });
    const task = makeTask({ userId, projectId: project.id, title: "T" });
    await a.store.upsert("tasks", task);
    await a.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "insert",
      changedFields: serializeTask(task), clientTs: task.updatedAt,
    });
    await a.engine.push();
    await b.engine.pull(null);

    const tsUpdate = nowIso();
    await a.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "update",
      changedFields: { title: "renamed" }, clientTs: tsUpdate,
    });
    await new Promise((r) => setTimeout(r, 10));
    const tsDelete = nowIso();
    await b.outbox.enqueue({
      entityTable: "tasks", entityId: task.id, op: "delete",
      changedFields: {}, clientTs: tsDelete,
    });

    await a.engine.push();
    await b.engine.push();
    await a.engine.pull(null);
    await b.engine.pull(null);

    const a2 = await a.store.findById<any>("tasks", task.id);
    const b2 = await b.store.findById<any>("tasks", task.id);
    expect(a2?.deletedAt).not.toBeNull();
    expect(b2?.deletedAt).not.toBeNull();
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
