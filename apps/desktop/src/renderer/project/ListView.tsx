import { useEffect, useState } from "react";
import { useTasks } from "../stores/tasks.js";
import { TaskRowItem } from "../components/TaskRowItem.js";
import { EmptyState } from "../components/EmptyState.js";
import { Input } from "../components/ui/input.js";
import { useToasts } from "../components/ui/toast.js";
import { CheckSquare } from "lucide-react";

const EMPTY_IDS: readonly string[] = [];

export function ListView({ projectId }: { projectId: string }) {
  const ids = useTasks((s) => s.byProject[projectId]) ?? EMPTY_IDS;
  const byId = useTasks((s) => s.byId);
  const create = useTasks((s) => s.create);
  const refresh = useTasks((s) => s.refreshProject);
  const [newTitle, setNewTitle] = useState("");
  const push = useToasts((s) => s.push);

  useEffect(() => { void refresh(projectId); }, [projectId, refresh]);

  const tasks = ids.map((i) => byId[i]).filter(Boolean);
  const open = tasks.filter((t) => t!.status !== "done");
  const done = tasks.filter((t) => t!.status === "done");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await create({ projectId, title: newTitle.trim() });
      setNewTitle("");
    } catch (err) { push((err as Error).message, "error"); }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-3 border-b border-[var(--border)]">
        <form onSubmit={submit}>
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="+ Neue Task hier eingeben & Enter" />
        </form>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {tasks.length === 0 && (
          <EmptyState icon={<CheckSquare size={32} />} title="Noch keine Tasks." hint="Tippe oben rein und drücke Enter." />
        )}
        {open.length > 0 && (
          <section>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Offen ({open.length})</div>
            <div className="space-y-1.5">{open.map((t) => <TaskRowItem key={t!.id} task={t!} />)}</div>
          </section>
        )}
        {done.length > 0 && (
          <section>
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Erledigt ({done.length})</div>
            <div className="space-y-1.5 opacity-60">{done.map((t) => <TaskRowItem key={t!.id} task={t!} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
