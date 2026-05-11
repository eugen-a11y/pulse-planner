import { create } from "zustand";
import { makeProject, nowIso, type Project } from "@pulse/core";
import type { MobileDeps } from "@/wiring/deps";

/**
 * Mobile projects store. Mirrors `apps/desktop/src/renderer/stores/projects.ts`
 * action surface; implementation mirrors `apps/desktop/src/main/ipc.ts` projects.*
 * handlers (no IPC — direct calls into deps.store + deps.outbox).
 */
let _deps: MobileDeps | null = null;
export function bindDeps(d: MobileDeps): void { _deps = d; }
function deps(): MobileDeps {
  if (!_deps) throw new Error("projects store: bindDeps() not called");
  return _deps;
}
function requireUserId(): string {
  const d = deps();
  if (!d.userId) throw new Error("not signed in");
  return d.userId;
}

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
    const d = deps();
    const userId = requireUserId();
    const list = await d.store.listSince<Project>("projects", null, { userId });
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const byId: Record<string, Project> = {};
    for (const p of list) byId[p.id] = p;
    set({ byId, order: list.map((p) => p.id), loaded: true });
  },
  async create(input) {
    const d = deps();
    const userId = requireUserId();
    const p = makeProject({
      userId,
      name: input.name,
      ...(input.color !== undefined ? { color: input.color } : {}),
    });
    await d.store.upsert("projects", p);
    await d.outbox.enqueue({
      entityTable: "projects", entityId: p.id, op: "insert",
      changedFields: {
        id: p.id, name: p.name, color: p.color,
        archived: p.archived, sortOrder: p.sortOrder,
        dueDate: p.dueDate, description: p.description,
        createdAt: p.createdAt, updatedAt: p.updatedAt, deletedAt: p.deletedAt,
      },
      clientTs: p.updatedAt,
    });
    await get().refresh();
    return p;
  },
  async update(id, fields) {
    const d = deps();
    const userId = requireUserId();
    const local = await d.store.findById<Project>("projects", id);
    if (!local || local.userId !== userId) throw new Error("project not found");
    const ts = nowIso();
    const updated: Project = { ...local, ...fields, updatedAt: ts };
    await d.store.upsert("projects", updated);
    const { id: _i, userId: _u, createdAt: _c, ...rest } = fields;
    void _i; void _u; void _c;
    await d.outbox.enqueue({
      entityTable: "projects", entityId: id, op: "update",
      changedFields: { ...rest, updatedAt: ts },
      clientTs: ts,
    });
    await get().refresh();
  },
  async remove(id) {
    const d = deps();
    requireUserId();
    const ts = nowIso();
    await d.store.softDelete("projects", id, ts);
    await d.outbox.enqueue({
      entityTable: "projects", entityId: id, op: "delete",
      changedFields: {}, clientTs: ts,
    });
    await get().refresh();
  },
}));
