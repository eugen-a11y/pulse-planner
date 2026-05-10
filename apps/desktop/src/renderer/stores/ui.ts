import { create } from "zustand";

export type ViewKey =
  | { kind: "today" }
  | { kind: "upcoming" }
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
