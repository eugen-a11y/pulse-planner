import { z } from "zod";
import { newId } from "./ids.js";
import { nowIso } from "./timestamps.js";

export const ACTIVITY_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "status_changed",
] as const;

export const ActivitySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  action: z.enum(ACTIVITY_ACTIONS),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export type Activity = z.infer<typeof ActivitySchema>;

export function makeActivity(input: {
  userId: string;
  entityType: string;
  entityId: string;
  action: (typeof ACTIVITY_ACTIONS)[number];
  payload: Record<string, unknown>;
}): Activity {
  return { id: newId(), ...input, createdAt: nowIso() };
}
