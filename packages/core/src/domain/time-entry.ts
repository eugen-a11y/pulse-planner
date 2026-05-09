import { z } from "zod";
import { newId } from "./ids.js";
import { nowIso, parseIso } from "./timestamps.js";

export const TimeEntrySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  taskId: z.string().min(1),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export type TimeEntry = z.infer<typeof TimeEntrySchema>;

export function makeTimeEntry(input: {
  userId: string;
  taskId: string;
  startedAt: string;
}): TimeEntry {
  const ts = nowIso();
  return {
    id: newId(),
    userId: input.userId,
    taskId: input.taskId,
    startedAt: input.startedAt,
    endedAt: null,
    durationSeconds: null,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}

export function stopTimer(entry: TimeEntry, endedAt: string): TimeEntry {
  const start = parseIso(entry.startedAt).getTime();
  const end = parseIso(endedAt).getTime();
  if (end < start) {
    throw new Error("end before start");
  }
  return {
    ...entry,
    endedAt,
    durationSeconds: Math.floor((end - start) / 1000),
    updatedAt: nowIso(),
  };
}
