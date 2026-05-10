import type { BrowserWindow } from "electron";
import type { AppDeps } from "./deps.js";
import type { PulseEvent, SyncStatus } from "./ipc-types.js";
import { nowIso } from "@pulse/core";

export function broadcast(win: BrowserWindow | null, channel: PulseEvent, data: unknown = null): void {
  win?.webContents.send(channel, data);
}

export async function pushSyncStatus(deps: AppDeps, getWin: () => Electron.BrowserWindow | null, partial: Partial<SyncStatus> = {}): Promise<void> {
  const outboxEntries = await deps.outbox.peekAll();
  const lastErrorEntry = outboxEntries.find((e) => e.lastError);
  const status: SyncStatus = {
    online: true,
    lastPushAt: null,
    lastPullAt: null,
    outboxSize: outboxEntries.length,
    lastError: lastErrorEntry?.lastError ?? null,
    ...partial,
  };
  getWin()?.webContents.send("sync.status", status);
}

export async function pushAfterMutation(deps: AppDeps, getWin: () => Electron.BrowserWindow | null): Promise<void> {
  if (!deps.engine) return;
  try {
    await deps.engine.push();
    await pushSyncStatus(deps, getWin, { lastPushAt: nowIso() });
  } catch (e) {
    if (isAuthError(e)) {
      await deps.auth.signOut();
      deps.engine = null;
      getWin()?.webContents.send("auth.expired", null);
    }
    await pushSyncStatus(deps, getWin);
  }
}

function isAuthError(e: unknown): boolean {
  const m = (e as Error)?.message ?? "";
  return /401|unauthor|jwt/i.test(m);
}

export function requireUser(deps: AppDeps): string {
  if (!deps.engine) throw new Error("not signed in");
  // We rely on engine.deps.userId being injected at signin.
  return (deps.engine as unknown as { deps: { userId: string } }).deps.userId;
}
