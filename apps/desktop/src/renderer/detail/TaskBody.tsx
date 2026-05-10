import { useEffect, useState } from "react";
import type { Task } from "@pulse/core";
import { useTasks } from "../stores/tasks.js";

export function TaskBody({ task }: { task: Task }) {
  const update = useTasks((s) => s.update);
  const [text, setText] = useState(task.description ?? "");
  useEffect(() => setText(task.description ?? ""), [task.id, task.description]);

  function save() {
    if (text === (task.description ?? "")) return;
    void update(task.id, { description: text || null });
  }

  return (
    <div>
      <div className="text-xs uppercase text-gray-400 mb-1">Beschreibung</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        rows={6}
        placeholder="Notizen, Markdown erlaubt…"
        className="w-full text-sm border border-[var(--border)] rounded p-2 resize-y bg-white"
      />
    </div>
  );
}
