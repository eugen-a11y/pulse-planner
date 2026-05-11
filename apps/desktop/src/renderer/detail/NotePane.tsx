import { useEffect, useState } from "react";
import type { Task, Note } from "@pulse/core";
import { api } from "../api.js";
import { Markdown } from "../components/Markdown.js";

export function NotePane({ task }: { task: Task }) {
  const [note, setNote] = useState<Note | null>(null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);

  async function load() {
    const list = await api.notes.listForTask(task.id) as Note[];
    const n = list[0] ?? null;
    setNote(n);
    setText(n?.bodyMd ?? "");
  }
  useEffect(() => { void load(); }, [task.id]);

  async function save() {
    setEditing(false);
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
      {editing ? (
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} onBlur={save} rows={4}
          placeholder="Markdown-Notiz für diese Task…"
          className="w-full text-sm border border-[var(--border)] rounded p-2 resize-y font-mono" />
      ) : text.trim() ? (
        <div onClick={() => setEditing(true)} className="cursor-text border border-transparent hover:border-[var(--border)] rounded p-2 -m-2">
          <Markdown source={text} />
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          className="w-full text-left text-xs text-gray-400 italic border border-dashed border-[var(--border)] rounded p-2 hover:border-pulse">
          Markdown-Notiz für diese Task…
        </button>
      )}
    </div>
  );
}
