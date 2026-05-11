import { useEffect, useState } from "react";
import type { Task } from "@pulse/core";
import { api } from "../api.js";
import { useTasks } from "../stores/tasks.js";
import { Input } from "../components/ui/input.js";
import { useToasts } from "../components/ui/toast.js";

export function SubtaskList({ parent }: { parent: Task }) {
  const [children, setChildren] = useState<Task[]>([]);
  const complete = useTasks((s) => s.complete);
  const update = useTasks((s) => s.update);
  const push = useToasts((s) => s.push);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  async function refresh() {
    // Inbox tasks (projectId=null) → fetch the unfiltered list and filter locally;
    // tasks.list with projectId omitted returns all tasks for the user.
    const all = parent.projectId
      ? await api.tasks.list({ projectId: parent.projectId })
      : await api.tasks.list({});
    setChildren(all.filter((t) => t.parentTaskId === parent.id && !t.deletedAt));
  }
  useEffect(() => { void refresh(); }, [parent.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await api.tasks.create({ projectId: parent.projectId, title: title.trim(), parentTaskId: parent.id });
      setTitle(""); setAdding(false);
      await refresh();
    } catch (err) { push((err as Error).message, "error"); }
  }

  if (parent.parentTaskId !== null) {
    // Phase-1 trigger forbids 3-level depth; hide subtask list under a subtask.
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs uppercase text-gray-400">Subtasks</div>
        <button onClick={() => setAdding(true)} className="text-xs text-pulse hover:underline">+ neu</button>
      </div>
      <div className="space-y-1">
        {children.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={c.status === "done"}
              onChange={() => {
                if (c.status === "done") void update(c.id, { status: "todo", completedAt: null }).then(refresh);
                else void complete(c.id).then(refresh);
              }}
              className="w-4 h-4 accent-pulse" />
            <span className={c.status === "done" ? "line-through text-gray-400" : ""}>{c.title}</span>
          </label>
        ))}
      </div>
      {adding && (
        <form onSubmit={submit} className="mt-2">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { setAdding(false); setTitle(""); }} placeholder="Subtask…" />
        </form>
      )}
    </div>
  );
}
