import { useEffect, useState } from "react";
import { Tag as TagIcon } from "lucide-react";
import { useTags } from "../stores/tags.js";
import { useTasks } from "../stores/tasks.js";
import { TaskRowItem } from "../components/TaskRowItem.js";
import { EmptyState } from "../components/EmptyState.js";
import { api } from "../api.js";
import type { Task } from "@pulse/core";

export function TagFilterView({ tagId }: { tagId: string }) {
  const tag = useTags((s) => s.byId[tagId]);
  const tasksById = useTasks((s) => s.byId);
  const [taskIds, setTaskIds] = useState<string[]>([]);

  // Load all tasks for this user, then filter by which carry the tag.
  // task_tags is small (single-user), this is acceptable up to a few thousand attachments.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const all = await api.tasks.list({});
      // Probe each task's tag membership in parallel — a v1 brute-force ok for a single user.
      const checks = await Promise.all(all.map(async (t) => ({
        t, tags: await api.tasks.tagsForTask(t.id),
      })));
      if (cancelled) return;
      const ids = checks.filter((c) => c.tags.includes(tagId)).map((c) => c.t.id);
      // Hydrate byId in case tasks weren't loaded (Inbox-only refresh)
      useTasks.setState((s) => {
        const idx: Record<string, Task> = { ...s.byId };
        for (const c of checks) idx[c.t.id] = c.t;
        return { byId: idx };
      });
      setTaskIds(ids);
    }
    void load();
    return () => { cancelled = true; };
  }, [tagId]);

  const tasks = taskIds.map((i) => tasksById[i]).filter(Boolean) as Task[];
  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  if (!tag) return <div className="p-6 text-gray-500">Tag nicht gefunden.</div>;

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-[var(--border)]">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <TagIcon className="text-pulse" size={20} style={{ color: tag.color }} />
          <span style={{ color: tag.color }}>#{tag.name}</span>
        </h1>
        <div className="text-xs text-gray-500 mt-1">{tasks.length} Tasks mit diesem Tag</div>
      </header>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {tasks.length === 0 && (
          <EmptyState icon={<TagIcon size={32} />} title={`Keine Tasks mit #${tag.name}`} />
        )}
        {open.length > 0 && (
          <section>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Offen ({open.length})</div>
            <div className="space-y-1.5">{open.map((t) => <TaskRowItem key={t.id} task={t} showProject />)}</div>
          </section>
        )}
        {done.length > 0 && (
          <section>
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Erledigt ({done.length})</div>
            <div className="space-y-1.5 opacity-60">{done.map((t) => <TaskRowItem key={t.id} task={t} showProject />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
