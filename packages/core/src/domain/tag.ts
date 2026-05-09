import { z } from "zod";
import { newId } from "./ids.js";
import { nowIso } from "./timestamps.js";

export const TagSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export type Tag = z.infer<typeof TagSchema>;

export function makeTag(input: { userId: string; name: string; color?: string }): Tag {
  const ts = nowIso();
  return {
    id: newId(),
    userId: input.userId,
    name: input.name,
    color: input.color ?? "#71717a",
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}
