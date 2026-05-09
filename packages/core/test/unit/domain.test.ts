import { describe, expect, it } from "vitest";
import { ProjectSchema, makeProject } from "../../src/domain/project.js";
import { TaskSchema, makeTask } from "../../src/domain/task.js";
import type { TaskStatus } from "../../src/domain/task.js";

describe("Project", () => {
  it("makeProject populates defaults", () => {
    const p = makeProject({ userId: "user-uuid", name: "Website" });
    expect(p.id).toBeTypeOf("string");
    expect(p.userId).toBe("user-uuid");
    expect(p.name).toBe("Website");
    expect(p.color).toBe("#2563eb");
    expect(p.archived).toBe(false);
    expect(p.sortOrder).toBe(0);
    expect(p.createdAt).toBe(p.updatedAt);
    expect(p.deletedAt).toBeNull();
  });

  it("ProjectSchema rejects empty name", () => {
    const r = ProjectSchema.safeParse({
      id: "00000000-0000-7000-8000-000000000000",
      userId: "00000000-0000-7000-8000-000000000001",
      name: "",
      color: "#2563eb",
      archived: false,
      sortOrder: 0,
      createdAt: "2026-05-09T00:00:00.000Z",
      updatedAt: "2026-05-09T00:00:00.000Z",
      deletedAt: null,
    });
    expect(r.success).toBe(false);
  });

  it("ProjectSchema accepts a valid project", () => {
    const r = ProjectSchema.safeParse(
      makeProject({ userId: "00000000-0000-7000-8000-000000000001", name: "X" }),
    );
    expect(r.success).toBe(true);
  });
});

describe("Task", () => {
  it("makeTask defaults", () => {
    const t = makeTask({
      userId: "user",
      projectId: "proj",
      title: "Do thing",
    });
    expect(t.id).toBeTypeOf("string");
    expect(t.status).toBe<TaskStatus>("todo");
    expect(t.priority).toBe(3);
    expect(t.parentTaskId).toBeNull();
    expect(t.dueDate).toBeNull();
    expect(t.completedAt).toBeNull();
    expect(t.recurrenceRule).toBeNull();
    expect(t.recurrenceParentId).toBeNull();
  });

  it("TaskSchema rejects priority out of range", () => {
    const t = makeTask({ userId: "u", projectId: "p", title: "x" });
    const r = TaskSchema.safeParse({ ...t, priority: 5 });
    expect(r.success).toBe(false);
  });

  it("TaskSchema rejects unknown status", () => {
    const t = makeTask({ userId: "u", projectId: "p", title: "x" });
    const r = TaskSchema.safeParse({ ...t, status: "blocked" });
    expect(r.success).toBe(false);
  });

  it("makeTask accepts due date and recurrence", () => {
    const t = makeTask({
      userId: "u",
      projectId: "p",
      title: "x",
      dueDate: "2026-06-01T09:00:00.000Z",
      recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
    });
    expect(t.dueDate).toBe("2026-06-01T09:00:00.000Z");
    expect(t.recurrenceRule).toBe("FREQ=WEEKLY;BYDAY=MO");
  });

  it("TaskSchema rejects invalid RRULE", () => {
    const t = makeTask({ userId: "u", projectId: "p", title: "x" });
    const r = TaskSchema.safeParse({ ...t, recurrenceRule: "garbage" });
    expect(r.success).toBe(false);
  });
});
