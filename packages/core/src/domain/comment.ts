import { z } from "zod";
import { newId } from "./ids.js";
import { nowIso } from "./timestamps.js";

export const CommentSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  taskId: z.string().min(1),
  bodyMd: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export type Comment = z.infer<typeof CommentSchema>;

export function makeComment(input: {
  userId: string;
  taskId: string;
  bodyMd: string;
}): Comment {
  const ts = nowIso();
  return {
    id: newId(),
    ...input,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}
