import { z } from "zod";
import { nowIso } from "./timestamps.js";

export const TaskTagSchema = z.object({
  taskId: z.string().min(1),
  tagId: z.string().min(1),
  userId: z.string().min(1),
  createdAt: z.string(),
});

export type TaskTag = z.infer<typeof TaskTagSchema>;

export function makeTaskTag(input: {
  userId: string;
  taskId: string;
  tagId: string;
}): TaskTag {
  return { ...input, createdAt: nowIso() };
}
