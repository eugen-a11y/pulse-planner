import { useEffect, useState } from "react";
import type { Task, Note } from "@pulse/core";
import { api } from "../api.js";

export function NotePane({ task }: { task: Task }) {
  const [note, setNote] = useState<Note | null>(null);
  const [text, setText] = useState("");

  async function load() {
    const list = await api.notes.listForTask(task.id) as Note[];
    const n = list[0] ?? null;
    setNote(n);
    setText(n?.bodyMd ?? "");
  }
  useEffect(() => { void load(); }, [task.id]);

  async function save() {
    if (!text.trim() && !note) return;
    if (!note) {
      const created = await api.notes.create({ taskId: task.id, bodyMd: text });
      setNote(created as Note);
    } else if (text !== note.bodyMd) {
      await api.notes.update(note.id, { bodyMd: text });
    }
  }

  return (
    <div>
      <div className="text-xs uppercase text-gray-400 mb-1">Notiz</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={save} rows={4}
        placeholder="Markdown-Notiz für diese Task…"
        className="w-full text-sm border border-[var(--border)] rounded p-2 resize-y" />
    </div>
  );
}
