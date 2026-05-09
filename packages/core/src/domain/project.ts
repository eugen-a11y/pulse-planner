import { z } from "zod";
import { newId } from "./ids.js";
import { nowIso } from "./timestamps.js";

export const ProjectSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1).max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  archived: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export type Project = z.infer<typeof ProjectSchema>;

export interface MakeProjectInput {
  userId: string;
  name: string;
  color?: string;
  sortOrder?: number;
}

export function makeProject(input: MakeProjectInput): Project {
  const ts = nowIso();
  return {
    id: newId(),
    userId: input.userId,
    name: input.name,
    color: input.color ?? "#2563eb",
    archived: false,
    sortOrder: input.sortOrder ?? 0,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}
