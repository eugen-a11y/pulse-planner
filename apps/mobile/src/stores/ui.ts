import { create } from "zustand";

/**
 * Mobile UI store. Ported 1:1 from `apps/desktop/src/renderer/stores/ui.ts`.
 * `dashboard` view kind kept for parity even though mobile uses tab routing
 * (Task 10) — the underlying ViewKey type can be reused for deep-link state.
 */
export type ViewKey =
  | { kind: "dashboard" }
  | { kind: "today" }
  | { kind: "upcoming" }
  | { kind: "inbox" }
  | { kind: "project"; projectId: string }
  | { kind: "tag"; tagId: string };

interface UiState {
  currentView: ViewKey;
  selectedTaskId: string | null;
  detailOpen: boolean;
  setView(view: ViewKey): void;
  selectTask(id: string | null): void;
  closeDetail(): void;
}

export const useUi = create<UiState>((set) => ({
  currentView: { kind: "today" },
  selectedTaskId: null,
  detailOpen: false,
  setView(view) { set({ currentView: view, selectedTaskId: null, detailOpen: false }); },
  selectTask(id) { set({ selectedTaskId: id, detailOpen: id !== null }); },
  closeDetail() { set({ selectedTaskId: null, detailOpen: false }); },
}));
