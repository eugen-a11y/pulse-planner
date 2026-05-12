/**
 * Notification reconciliation bridge. Couples the pure reconciler
 * (`./reconciler.ts`) to the Expo adapter (`../platform/ExpoNotifications.ts`)
 * and exposes a single debounced entry point the rest of the app can call
 * after any task mutation.
 */
import type { MobileDeps } from "@/wiring/deps";
import type { Task } from "@pulse/core";
import { reconcile } from "./reconciler";
import { applyReconcileResult, listScheduled } from "@/platform/ExpoNotifications";

let _deps: MobileDeps | null = null;
export function bindNotificationDeps(d: MobileDeps): void { _deps = d; }
export function getNotificationDeps(): MobileDeps | null { return _deps; }

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let queued = false;

const DEBOUNCE_MS = 500;

/** Cancel pending debounced reconcile (used by tests / teardown). */
export function clearReconcileDebounce(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

/**
 * Run a single reconcile pass. Loads all tasks for the current user, reads
 * the live scheduled set, computes the diff, and applies it.
 */
export async function reconcileNotifications(): Promise<void> {
  if (running) {
    queued = true;
    return;
  }
  running = true;
  try {
    const deps = _deps;
    if (!deps || !deps.userId) return;
    const all = await deps.store.listSince<Task>("tasks", null, { userId: deps.userId });
    const scheduled = await listScheduled();
    const result = reconcile(
      all as unknown as Parameters<typeof reconcile>[0],
      scheduled,
      new Date(),
    );
    await applyReconcileResult(result);
  } catch {
    // Best-effort; never throw across the lifecycle boundary.
  } finally {
    running = false;
    if (queued) {
      queued = false;
      // Schedule another pass on the next tick.
      setTimeout(() => { void reconcileNotifications(); }, 0);
    }
  }
}

/**
 * Debounced wrapper. Call after any mutation; coalesces bursts into a
 * single reconcile within DEBOUNCE_MS.
 */
export function reconcileNotificationsDebounced(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void reconcileNotifications();
  }, DEBOUNCE_MS);
}
