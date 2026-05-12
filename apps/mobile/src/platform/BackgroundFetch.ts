/**
 * iOS background fetch (Task 21).
 *
 * Defines a TaskManager task at module load (`pulse-bg-pull`) and exposes
 * `registerBackgroundFetch()` to schedule it via `BackgroundFetch.registerTaskAsync`
 * with a 30-minute minimumInterval hint (iOS scheduler decides actual cadence).
 *
 * --- Why module-level `defineTask` ----------------------------------------
 * When iOS wakes the app in the background, it boots the JS bundle in a
 * headless runtime and immediately looks up the task by name. Per Expo's
 * documentation, the definition MUST live at module load time (top-level,
 * not inside a function), otherwise the lookup races the dispatch and the
 * fetch is dropped with "Task not found".
 *
 * --- Why we build a fresh `deps` per invocation ---------------------------
 * The background runtime may or may not share module state with the
 * foreground app — in practice on iOS it gets its own JS context. Calling
 * `buildDeps()` here opens its own SQLite handle and Supabase client, and
 * `auth.restoreSession()` pulls the persisted token from SecureStore. This
 * is self-contained and idempotent: it does not depend on the foreground
 * `app/_layout.tsx` boot sequence having run.
 *
 * --- No Zustand store available ------------------------------------------
 * `useTasks` / `useProjects` aren't bound here, so we build the widget
 * snapshot directly from `store.listSince("tasks", null, ...)` /
 * `listSince("projects", ...)`. Filtering + sorting is delegated to the
 * pure `buildTodaySnapshot` selector that the foreground also uses, so the
 * background-written file is byte-identical to one written from the app.
 */

import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import type { Task, Project } from "@pulse/core";
import { buildDeps } from "@/wiring/deps";
import { buildTodaySnapshot, writeSnapshot } from "@/platform/WidgetData";
import { appendDebugLog } from "@/lib/debugLog";

const TASK_NAME = "pulse-bg-pull";

TaskManager.defineTask(TASK_NAME, async () => {
  const start = Date.now();
  try {
    const deps = await buildDeps();
    const session = await deps.auth.restoreSession();
    if (!session) {
      await appendDebugLog(`[bg] no session, skip pull`);
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    deps.setUserId(session.user.id);
    if (!deps.engine) {
      await appendDebugLog(`[bg] engine not ready after setUserId`);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
    await deps.engine.pull();
    // Build snapshot from a quick listSince — no Zustand store is bound in
    // the background runtime, so we read raw rows out of the local SQLite.
    const allTasks = (await deps.store.listSince<Task>("tasks", null, {
      userId: session.user.id,
    })) as unknown as Task[];
    const allProjects = (await deps.store.listSince<Project>("projects", null, {
      userId: session.user.id,
    })) as unknown as Project[];
    const snapshot = buildTodaySnapshot({
      now: new Date(),
      tasks: allTasks.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        status: t.status,
        deletedAt: t.deletedAt,
        projectId: t.projectId,
      })),
      projects: allProjects.map((p) => ({ id: p.id, color: p.color })),
    });
    await writeSnapshot(snapshot);
    await appendDebugLog(
      `[bg] pull ok in ${Date.now() - start}ms (${snapshot.tasks.length} today)`,
    );
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (e) {
    await appendDebugLog(`[bg] FAIL: ${(e as Error).message}`);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Idempotent registration. Skips when:
 *  - the system reports BackgroundFetch as Restricted or Denied
 *  - the task is already registered (avoids re-registering on every boot)
 *
 * iOS treats `minimumInterval` as a hint; the real cadence is decided by
 * the system scheduler based on usage patterns. 30 min matches the widget
 * timeline refresh window used in `targets/TodayWidget`.
 */
export async function registerBackgroundFetch(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      await appendDebugLog(`[bg] not available: status=${status ?? "null"}`);
      return;
    }
    const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (!registered) {
      await BackgroundFetch.registerTaskAsync(TASK_NAME, {
        minimumInterval: 30 * 60, // 30 minutes (iOS treats as hint)
        stopOnTerminate: false,
        startOnBoot: true,
      });
      await appendDebugLog(`[bg] registered ${TASK_NAME}`);
    }
  } catch (e) {
    await appendDebugLog(`[bg] register failed: ${(e as Error).message}`);
  }
}
