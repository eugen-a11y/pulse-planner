import { create } from "zustand";
import type { Tag } from "@pulse/core";
import { api } from "../api.js";

interface TagsState {
  byId: Record<string, Tag>;
  order: string[];
  refresh: () => Promise<void>;
  create: (input: { name: string; color?: string }) => Promise<Tag>;
  attach: (taskId: string, tagId: string) => Promise<void>;
  detach: (taskId: string, tagId: string) => Promise<void>;
}

export const useTags = create<TagsState>((set, get) => ({
  byId: {},
  order: [],
  async refresh() {
    const list = await api.tags.list();
    list.sort((a, b) => a.name.localeCompare(b.name));
    const byId: Record<string, Tag> = {};
    for (const t of list) byId[t.id] = t;
    set({ byId, order: list.map((t) => t.id) });
  },
  async create(input) {
    const t = await api.tags.create(input);
    await get().refresh();
    return t;
  },
  async attach(taskId, tagId) {
    await api.tags.attach(taskId, tagId);
  },
  async detach(taskId, tagId) {
    await api.tags.detach(taskId, tagId);
  },
}));

api.events.on("tags.changed", () => { void useTags.getState().refresh(); });
