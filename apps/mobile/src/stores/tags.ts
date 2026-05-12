import { create } from "zustand";
import { makeTag, makeTaskTag, nowIso, type Tag } from "@pulse/core";
import type { MobileDeps } from "@/wiring/deps";

/**
 * Mobile tags store. Mirrors `apps/desktop/src/renderer/stores/tags.ts` action
 * surface; implementation mirrors `apps/desktop/src/main/ipc.ts` tags.* handlers
 * (including raw SQL for attach/detach via expo-sqlite's runAsync/getAllAsync).
 */
let _deps: MobileDeps | null = null;
export function bindDeps(d: MobileDeps): void { _deps = d; }
function deps(): MobileDeps {
  if (!_deps) throw new Error("tags store: bindDeps() not called");
  return _deps;
}
function requireUserId(): string {
  const d = deps();
  if (!d.userId) throw new Error("not signed in");
  return d.userId;
}

interface TagsState {
  byId: Record<string, Tag>;
  order: string[];
  /** Cache of taskId → tagIds. Populated lazily by tagsForTask(). */
  tagsForTask: Record<string, string[]>;
  refresh: () => Promise<void>;
  create: (input: { name: string; color?: string }) => Promise<Tag>;
  /**
   * Update a tag's mutable fields (name / color). Desktop has no tags.update
   * IPC handler today; the mobile store implements it directly to back the
   * Task 15 "Umbenennen / Farbe ändern" affordance. Outbox payload mirrors
   * `projects.update` shape: { name?, color?, updatedAt }.
   */
  update: (id: string, fields: Partial<Pick<Tag, "name" | "color">>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  attach: (taskId: string, tagId: string) => Promise<void>;
  detach: (taskId: string, tagId: string) => Promise<void>;
  loadTagsForTask: (taskId: string) => Promise<string[]>;
}

export const useTags = create<TagsState>((set, get) => ({
  byId: {},
  order: [],
  tagsForTask: {},

  async refresh() {
    const d = deps();
    const userId = requireUserId();
    const list = await d.store.listSince<Tag>("tags", null, { userId });
    list.sort((a, b) => a.name.localeCompare(b.name));
    const byId: Record<string, Tag> = {};
    for (const t of list) byId[t.id] = t;
    set({ byId, order: list.map((t) => t.id) });
  },

  async create(input) {
    const d = deps();
    const userId = requireUserId();
    const tag = makeTag({
      userId, name: input.name,
      ...(input.color !== undefined ? { color: input.color } : {}),
    });
    await d.store.upsert("tags", tag);
    await d.outbox.enqueue({
      entityTable: "tags", entityId: tag.id, op: "insert",
      changedFields: {
        id: tag.id, name: tag.name, color: tag.color,
        createdAt: tag.createdAt, updatedAt: tag.updatedAt, deletedAt: tag.deletedAt,
      },
      clientTs: tag.updatedAt,
    });
    await get().refresh();
    return tag;
  },

  async update(id, fields) {
    const d = deps();
    const userId = requireUserId();
    const local = await d.store.findById<Tag>("tags", id);
    if (!local || local.userId !== userId) throw new Error("tag not found");
    const ts = nowIso();
    const updated: Tag = { ...local, ...fields, updatedAt: ts };
    await d.store.upsert("tags", updated);
    const { name, color } = fields;
    const changed: Record<string, unknown> = { updatedAt: ts };
    if (name !== undefined) changed.name = name;
    if (color !== undefined) changed.color = color;
    await d.outbox.enqueue({
      entityTable: "tags", entityId: id, op: "update",
      changedFields: changed, clientTs: ts,
    });
    await get().refresh();
  },

  async remove(id) {
    const d = deps();
    requireUserId();
    const ts = nowIso();
    await d.store.softDelete("tags", id, ts);
    // task_tags has no soft-delete column; nuke the links.
    await d.db.runAsync("DELETE FROM task_tags WHERE tag_id = ?", id);
    await d.outbox.enqueue({
      entityTable: "tags", entityId: id, op: "delete",
      changedFields: {}, clientTs: ts,
    });
    await get().refresh();
  },

  async attach(taskId, tagId) {
    const d = deps();
    const userId = requireUserId();
    const tt = makeTaskTag({ userId, taskId, tagId });
    await d.store.upsert("task_tags", tt as never);
    await d.outbox.enqueue({
      entityTable: "task_tags", entityId: taskId + ":" + tagId, op: "insert",
      changedFields: {
        task_id: taskId, tag_id: tagId, user_id: userId, created_at: tt.createdAt,
      },
      clientTs: tt.createdAt,
    });
    // Update cache.
    const cache = get().tagsForTask[taskId] ?? [];
    if (!cache.includes(tagId)) {
      set((s) => ({ tagsForTask: { ...s.tagsForTask, [taskId]: [...cache, tagId] } }));
    }
  },

  async detach(taskId, tagId) {
    const d = deps();
    requireUserId();
    await d.db.runAsync(
      "DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?",
      taskId, tagId,
    );
    // task_tags has no soft-delete + no updated_at; v1 relies on realtime sync.
    const cache = get().tagsForTask[taskId] ?? [];
    set((s) => ({
      tagsForTask: { ...s.tagsForTask, [taskId]: cache.filter((id) => id !== tagId) },
    }));
  },

  async loadTagsForTask(taskId) {
    const d = deps();
    requireUserId();
    const rows = await d.db.getAllAsync<{ tag_id: string }>(
      "SELECT tag_id FROM task_tags WHERE task_id = ?",
      taskId,
    );
    const ids = rows.map((r) => r.tag_id);
    set((s) => ({ tagsForTask: { ...s.tagsForTask, [taskId]: ids } }));
    return ids;
  },
}));
