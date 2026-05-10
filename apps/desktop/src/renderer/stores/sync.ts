import { create } from "zustand";
import { api } from "../api.js";
import type { SyncStatus } from "../../main/ipc-types.js";

interface SyncState {
  status: SyncStatus;
}

export const useSync = create<SyncState>(() => ({
  status: { online: true, lastPushAt: null, lastPullAt: null, outboxSize: 0, lastError: null },
}));

api.events.on("sync.status", (data) => {
  useSync.setState({ status: data as SyncStatus });
});

export async function manualPull(): Promise<void> { await api.sync.pullNow(); }
export async function manualPush(): Promise<void> { await api.sync.pushNow(); }
