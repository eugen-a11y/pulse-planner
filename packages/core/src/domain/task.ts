import { RRule } from "rrule";
import { z } from "zod";
import { newId } from "./ids.js";
import { nowIso } from "./timestamps.js";

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const RRuleString = z.string().refine(
  (s) => {
    try {
      RRule.fromString(`RRULE:${s}`);
      return true;
    } catch {
      return false;
    }
  },
  { message: "invalid RRULE" },
);

export const TaskSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  projectId: z.string().min(1).nullable(),
  parentTaskId: z.string().nullable(),
  title: z.string().min(1).max(500),
  description: z.string().nullable(),
  status: z.enum(TASK_STATUSES),
  priority: z.number().int().min(1).max(3),
  dueDate: z.string().nullable(),
  completedAt: z.string().nullable(),
  sortOrder: z.number().int(),
  recurrenceRule: RRuleString.nullable(),
  recurrenceParentId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export type Task = z.infer<typeof TaskSchema>;

export interface MakeTaskInput {
  userId: string;
  projectId: string | null;
  title: string;
  description?: string | null;
  parentTaskId?: string | null;
  status?: TaskStatus;
  priority?: 1 | 2 | 3;
  dueDate?: string | null;
  sortOrder?: number;
  recurrenceRule?: string | null;
  recurrenceParentId?: string | null;
}

export function makeTask(input: MakeTaskInput): Task {
  const ts = nowIso();
  return {
    id: newId(),
    userId: input.userId,
    projectId: input.projectId ?? null,
    parentTaskId: input.parentTaskId ?? null,
    title: input.title,
    description: input.description ?? null,
    status: input.status ?? "todo",
    priority: input.priority ?? 2,
    dueDate: input.dueDate ?? null,
    completedAt: null,
    sortOrder: input.sortOrder ?? 0,
    recurrenceRule: input.recurrenceRule ?? null,
    recurrenceParentId: input.recurrenceParentId ?? null,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}
