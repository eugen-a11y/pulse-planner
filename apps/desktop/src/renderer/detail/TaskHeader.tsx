import { useState } from "react";
import type { Task } from "@pulse/core";
import { useTasks } from "../stores/tasks.js";
import { useProjects } from "../stores/projects.js";
import { useToasts } from "../components/ui/toast.js";

export function TaskHeader({ task }: { task: Task }) {
  const project = useProjects((s) => s.byId[task.projectId]);
  const update = useTasks((s) => s.update);
  const push = useToasts((s) => s.push);
  const [title, setTitle] = useState(task.title);
  const [editing, setEditing] = useState(false);

  async function save() {
    setEditing(false);
    if (title.trim() && title !== task.title) {
      try { await update(task.id, { title: title.trim() }); }
      catch (e) { push((e as Error).message, "error"); }
    } else {
      setTitle(task.title);
    }
  }

  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">{project?.name ?? "—"}</div>
      {editing ? (
        <input
          autoFocus value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setTitle(task.title); setEditing(false); } }}
          className="text-xl font-semibold w-full bg-transparent border-b border-pulse outline-none"
        />
      ) : (
        <h2 onClick={() => setEditing(true)} className="text-xl font-semibold cursor-text">{task.title}</h2>
      )}
    </div>
  );
}
