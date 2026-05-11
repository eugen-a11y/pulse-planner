import type { MobileDeps } from "@/wiring/deps";
import { useProjects } from "./projects";
import { useTasks } from "./tasks";
import { useTags } from "./tags";

/**
 * Re-fetch all in-memory store data from the local SQLite DB. Called after
 * realtime events (debounced 500ms) and on AppState=active. Bails if not
 * signed in so it's safe to invoke from lifecycle code.
 */
export async function refreshAll(deps: MobileDeps): Promise<void> {
  if (!deps.engine || !deps.userId) return;
  await Promise.all([
    useProjects.getState().refresh(),
    useTasks.getState().refreshToday(),
    useTasks.getState().refreshUpcoming(),
    useTasks.getState().refreshInbox(),
    useTags.getState().refresh(),
  ]);
}
