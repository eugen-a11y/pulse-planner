import { create } from "zustand";
import type { Project } from "@pulse/core";
import { api } from "../api.js";

interface ProjectsState {
  byId: Record<string, Project>;
  order: string[];
  loaded: boolean;
  refresh: () => Promise<void>;
  create: (input: { name: string; color?: string }) => Promise<Project>;
  update: (id: string, fields: Partial<Project>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useProjects = create<ProjectsState>((set, get) => ({
  byId: {},
  order: [],
  loaded: false,
  async refresh() {
    const list = await api.projects.list();
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const byId: Record<string, Project> = {};
    for (const p of list) byId[p.id] = p;
    set({ byId, order: list.map((p) => p.id), loaded: true });
  },
  async create(input) {
    const p = await api.projects.create(input);
    await get().refresh();
    return p;
  },
  async update(id, fields) {
    await api.projects.update(id, fields);
    await get().refresh();
  },
  async remove(id) {
    await api.projects.delete(id);
    await get().refresh();
  },
}));

api.events.on("projects.changed", () => { void useProjects.getState().refresh(); });
