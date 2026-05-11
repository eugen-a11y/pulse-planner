import { useEffect, useState } from "react";
import type { Task } from "@pulse/core";
import { useTasks } from "../stores/tasks.js";
import { Markdown } from "../components/Markdown.js";

export function TaskBody({ task }: { task: Task }) {
  const update = useTasks((s) => s.update);
  const [text, setText] = useState(task.description ?? "");
  const [editing, setEditing] = useState(false);
  useEffect(() => setText(task.description ?? ""), [task.id, task.description]);

  function save() {
    setEditing(false);
    if (text === (task.description ?? "")) return;
    void update(task.id, { description: text || null });
  }

  return (
    <div>
      <div className="text-xs uppercase text-gray-400 mb-1">Beschreibung</div>
      {editing ? (
        <textarea
          autoFocus value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          rows={6}
          placeholder="Notizen, Markdown erlaubt…"
          className="w-full text-sm border border-[var(--border)] rounded p-2 resize-y bg-white font-mono"
        />
      ) : task.description ? (
        <div onClick={() => setEditing(true)} className="cursor-text border border-transparent hover:border-[var(--border)] rounded p-2 -m-2">
          <Markdown source={task.description} />
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          className="w-full text-left text-xs text-gray-400 italic border border-dashed border-[var(--border)] rounded p-2 hover:border-pulse">
          Notizen, Markdown erlaubt…
        </button>
      )}
    </div>
  );
}
