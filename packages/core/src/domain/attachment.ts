import { z } from "zod";
import { newId } from "./ids.js";
import { nowIso } from "./timestamps.js";

export const AttachmentSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  taskId: z.string().min(1),
  storagePath: z.string().min(1),
  filename: z.string().min(1),
  mime: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export type Attachment = z.infer<typeof AttachmentSchema>;

export function makeAttachment(input: {
  userId: string;
  taskId: string;
  storagePath: string;
  filename: string;
  mime: string;
  sizeBytes: number;
}): Attachment {
  const ts = nowIso();
  return {
    id: newId(),
    ...input,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}
