import type { MobileDeps } from "@/wiring/deps";
import * as auth from "./auth";
import * as projects from "./projects";
import * as tasks from "./tasks";
import * as tags from "./tags";
import * as sync from "./sync";
import { bindNotificationDeps } from "@/notifications";

export { useAuth } from "./auth";
export { useProjects } from "./projects";
export { useTasks } from "./tasks";
export { useTags } from "./tags";
export { useUi, type ViewKey } from "./ui";
export { useSync, manualPull, manualPush, patchStatus, type SyncStatus } from "./sync";
export { refreshAll } from "./refresh-all";

/**
 * Bind every store to the resolved MobileDeps. Call once after buildDeps()
 * resolves, before any store action runs. Mirrors the way desktop's renderer
 * imports `api` synchronously via the Electron preload bridge.
 */
export function bindStoresToDeps(deps: MobileDeps): void {
  auth.bindDeps(deps);
  projects.bindDeps(deps);
  tasks.bindDeps(deps);
  tags.bindDeps(deps);
  sync.bindDeps(deps);
  bindNotificationDeps(deps);
}
