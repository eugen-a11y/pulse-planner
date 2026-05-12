import { create } from "zustand";
import type { MobileDeps } from "@/wiring/deps";

/**
 * Mobile sync status store. Mirrors `apps/desktop/src/main/ipc-types.ts`
 * `SyncStatus` shape. The lifecycle code in `_layout.tsx` (and helpers in
 * refresh-all.ts) pushes updates via `useSync.setState({ status: ... })`.
 *
 * Task 22 added a top-level `state` field that the SyncStatusPill reads
 * directly. The lifecycle code in `_layout.tsx` is the single source of
 * truth — it flips `state` to `"syncing"` before each pull, `"idle"` on
 * success, `"error"` on failure. The NetInfo subscription inside
 * `SyncStatusPill` flips `state` to `"offline"` when connectivity drops
 * and back to `"idle"` on reconnect (unless an error is still surfaced).
 */
export type SyncLifecycleState = "idle" | "syncing" | "error" | "offline";

export interface SyncStatus {
  online: boolean;
  lastPushAt: string | null;
  lastPullAt: string | null;
  outboxSize: number;
  lastError: string | null;
}

interface SyncState {
  status: SyncStatus;
  state: SyncLifecycleState;
}

export const useSync = create<SyncState>(() => ({
  status: {
    online: true,
    lastPushAt: null,
    lastPullAt: null,
    outboxSize: 0,
    lastError: null,
  },
  state: "idle",
}));

let _deps: MobileDeps | null = null;
export function bindDeps(d: MobileDeps): void { _deps = d; }
function deps(): MobileDeps {
  if (!_deps) throw new Error("sync store: bindDeps() not called");
  return _deps;
}

/** Patch sync status, recomputing outboxSize from the current outbox. */
export async function patchStatus(partial: Partial<SyncStatus>): Promise<void> {
  const d = _deps;
  let outboxSize = useSync.getState().status.outboxSize;
  if (d) {
    try { outboxSize = (await d.outbox.peekAll()).length; } catch { /* keep last */ }
  }
  useSync.setState((s) => ({ status: { ...s.status, ...partial, outboxSize } }));
}

/** Set the top-level sync lifecycle state. Used by `_layout.tsx`. */
export function setSyncState(state: SyncLifecycleState): void {
  useSync.setState({ state });
}

export async function manualPull(): Promise<void> {
  const d = deps();
  if (!d.engine) return;
  await d.engine.pull();
  await patchStatus({ lastPullAt: new Date().toISOString(), lastError: null });
}
export async function manualPush(): Promise<void> {
  const d = deps();
  if (!d.engine) return;
  await d.engine.push();
  await patchStatus({ lastPushAt: new Date().toISOString(), lastError: null });
}
