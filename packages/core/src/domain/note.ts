import { z } from "zod";
import { newId } from "./ids.js";
import { nowIso } from "./timestamps.js";

export const NoteSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    projectId: z.string().nullable(),
    taskId: z.string().nullable(),
    bodyMd: z.string().min(1),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable(),
  })
  .refine((n) => (n.projectId === null) !== (n.taskId === null), {
    message: "exactly one of projectId or taskId must be set",
  });

export type Note = z.infer<typeof NoteSchema>;

export function makeProjectNote(input: {
  userId: string;
  projectId: string;
  bodyMd: string;
}): Note {
  const ts = nowIso();
  return {
    id: newId(),
    userId: input.userId,
    projectId: input.projectId,
    taskId: null,
    bodyMd: input.bodyMd,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}

export function makeTaskNote(input: {
  userId: string;
  taskId: string;
  bodyMd: string;
}): Note {
  const ts = nowIso();
  return {
    id: newId(),
    userId: input.userId,
    projectId: null,
    taskId: input.taskId,
    bodyMd: input.bodyMd,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}
