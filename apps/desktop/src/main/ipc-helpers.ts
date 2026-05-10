import type { BrowserWindow } from "electron";
import type { AppDeps } from "./deps.js";
import type { PulseEvent } from "./ipc-types.js";

export function broadcast(win: BrowserWindow | null, channel: PulseEvent, data: unknown = null): void {
  win?.webContents.send(channel, data);
}

export async function pushAfterMutation(deps: AppDeps): Promise<void> {
  if (!deps.engine) return;
  try {
    await deps.engine.push();
  } catch {
    // outbox carries lastError; renderer surfaces it via sync.status
  }
}

export function requireUser(deps: AppDeps): string {
  if (!deps.engine) throw new Error("not signed in");
  // We rely on engine.deps.userId being injected at signin.
  return (deps.engine as unknown as { deps: { userId: string } }).deps.userId;
}
