import { create } from "zustand";
import type { Task } from "@pulse/core";
import { api } from "../api.js";

interface TasksState {
  byId: Record<string, Task>;
  todayIds: string[];
  upcomingIds: string[];
  byProject: Record<string, string[]>;
  loaded: boolean;
  refreshToday: () => Promise<void>;
  refreshUpcoming: () => Promise<void>;
  refreshProject: (projectId: string) => Promise<void>;
  create: (input: Parameters<typeof api.tasks.create>[0]) => Promise<Task>;
  update: (id: string, fields: Partial<Task>) => Promise<void>;
  complete: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function indexBy(list: Task[]): Record<string, Task> {
  const out: Record<string, Task> = {};
  for (const t of list) out[t.id] = t;
  return out;
}

export const useTasks = create<TasksState>((set, get) => ({
  byId: {},
  todayIds: [],
  upcomingIds: [],
  byProject: {},
  loaded: false,
  async refreshToday() {
    const list = await api.tasks.listToday();
    const idx = indexBy(list);
    set((s) => ({ byId: { ...s.byId, ...idx }, todayIds: list.map((t) => t.id), loaded: true }));
  },
  async refreshUpcoming() {
    const list = await api.tasks.listUpcoming();
    const idx = indexBy(list);
    set((s) => ({ byId: { ...s.byId, ...idx }, upcomingIds: list.map((t) => t.id), loaded: true }));
  },
  async refreshProject(projectId) {
    const list = await api.tasks.list({ projectId });
    const idx = indexBy(list);
    set((s) => ({
      byId: { ...s.byId, ...idx },
      byProject: { ...s.byProject, [projectId]: list.map((t) => t.id) },
      loaded: true,
    }));
  },
  async create(input) {
    const t = await api.tasks.create(input);
    await get().refreshProject(input.projectId);
    return t;
  },
  async update(id, fields) {
    await api.tasks.update(id, fields);
    const t = get().byId[id];
    if (t) {
      await get().refreshProject(t.projectId);
      await get().refreshToday();
    }
  },
  async complete(id) {
    await api.tasks.complete(id);
    const t = get().byId[id];
    if (t) {
      await get().refreshProject(t.projectId);
      await get().refreshToday();
    }
  },
  async remove(id) {
    await api.tasks.delete(id);
    const t = get().byId[id];
    if (t) {
      await get().refreshProject(t.projectId);
      await get().refreshToday();
    }
  },
}));

api.events.on("tasks.changed", () => {
  void useTasks.getState().refreshToday();
  void useTasks.getState().refreshUpcoming();
});
