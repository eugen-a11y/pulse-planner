import { describe, expect, it } from "vitest";
import { ProjectSchema, makeProject } from "../../src/domain/project.js";
import { TaskSchema, makeTask } from "../../src/domain/task.js";
import type { TaskStatus } from "../../src/domain/task.js";
import { TagSchema, makeTag } from "../../src/domain/tag.js";
import { TaskTagSchema, makeTaskTag } from "../../src/domain/task-tag.js";
import { AttachmentSchema, makeAttachment } from "../../src/domain/attachment.js";
import { makeTimeEntry, stopTimer } from "../../src/domain/time-entry.js";
import { CommentSchema, makeComment } from "../../src/domain/comment.js";
import { NoteSchema, makeProjectNote, makeTaskNote } from "../../src/domain/note.js";
import { ActivitySchema, makeActivity } from "../../src/domain/activity.js";

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
    expect(t.priority).toBe(2);
    expect(t.parentTaskId).toBeNull();
    expect(t.dueDate).toBeNull();
    expect(t.completedAt).toBeNull();
    expect(t.recurrenceRule).toBeNull();
    expect(t.recurrenceParentId).toBeNull();
  });

  it("TaskSchema rejects priority out of range", () => {
    const t = makeTask({ userId: "u", projectId: "p", title: "x" });
    const r = TaskSchema.safeParse({ ...t, priority: 4 });
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

describe("Tag", () => {
  it("defaults color and validates", () => {
    const t = makeTag({ userId: "u", name: "urgent" });
    expect(TagSchema.safeParse(t).success).toBe(true);
    expect(t.color).toBe("#71717a");
  });
});

describe("TaskTag", () => {
  it("makes a junction row", () => {
    const tt = makeTaskTag({ userId: "u", taskId: "t", tagId: "g" });
    expect(TaskTagSchema.safeParse(tt).success).toBe(true);
  });
});

describe("Attachment", () => {
  it("validates", () => {
    const a = makeAttachment({
      userId: "u",
      taskId: "t",
      storagePath: "attachments/u/t/file.png",
      filename: "file.png",
      mime: "image/png",
      sizeBytes: 1024,
    });
    expect(AttachmentSchema.safeParse(a).success).toBe(true);
  });

  it("rejects non-positive size", () => {
    const a = makeAttachment({
      userId: "u", taskId: "t", storagePath: "p", filename: "f", mime: "x/y", sizeBytes: 1,
    });
    expect(AttachmentSchema.safeParse({ ...a, sizeBytes: 0 }).success).toBe(false);
  });
});

describe("TimeEntry", () => {
  it("makeTimeEntry has running state", () => {
    const te = makeTimeEntry({ userId: "u", taskId: "t", startedAt: "2026-05-09T10:00:00.000Z" });
    expect(te.endedAt).toBeNull();
    expect(te.durationSeconds).toBeNull();
  });

  it("stopTimer sets endedAt and computes duration", () => {
    const te = makeTimeEntry({ userId: "u", taskId: "t", startedAt: "2026-05-09T10:00:00.000Z" });
    const stopped = stopTimer(te, "2026-05-09T10:01:30.000Z");
    expect(stopped.endedAt).toBe("2026-05-09T10:01:30.000Z");
    expect(stopped.durationSeconds).toBe(90);
  });

  it("rejects negative duration", () => {
    const te = makeTimeEntry({ userId: "u", taskId: "t", startedAt: "2026-05-09T10:00:00.000Z" });
    expect(() =>
      stopTimer(te, "2026-05-09T09:59:00.000Z"),
    ).toThrowError(/end before start/);
  });
});

describe("Comment", () => {
  it("validates", () => {
    const c = makeComment({ userId: "u", taskId: "t", bodyMd: "looks good" });
    expect(CommentSchema.safeParse(c).success).toBe(true);
  });
});

describe("Note", () => {
  it("project note has projectId only", () => {
    const n = makeProjectNote({ userId: "u", projectId: "p", bodyMd: "hi" });
    expect(n.projectId).toBe("p");
    expect(n.taskId).toBeNull();
    expect(NoteSchema.safeParse(n).success).toBe(true);
  });

  it("task note has taskId only", () => {
    const n = makeTaskNote({ userId: "u", taskId: "t", bodyMd: "hi" });
    expect(n.projectId).toBeNull();
    expect(n.taskId).toBe("t");
    expect(NoteSchema.safeParse(n).success).toBe(true);
  });

  it("rejects when both ids set or both null", () => {
    const n = makeTaskNote({ userId: "u", taskId: "t", bodyMd: "x" });
    expect(NoteSchema.safeParse({ ...n, projectId: "p" }).success).toBe(false);
    expect(NoteSchema.safeParse({ ...n, taskId: null }).success).toBe(false);
  });
});

describe("Activity", () => {
  it("validates", () => {
    const a = makeActivity({
      userId: "u",
      entityType: "task",
      entityId: "t",
      action: "status_changed",
      payload: { from: "todo", to: "done" },
    });
    expect(ActivitySchema.safeParse(a).success).toBe(true);
  });
});
