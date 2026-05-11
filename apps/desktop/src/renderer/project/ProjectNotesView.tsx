import { useEffect, useState } from "react";
import { Edit3 } from "lucide-react";
import type { Note } from "@pulse/core";
import { api } from "../api.js";
import { Markdown } from "../components/Markdown.js";

export function ProjectNotesView({ projectId }: { projectId: string }) {
  const [note, setNote] = useState<Note | null>(null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);
  async function load() {
    const list = await api.notes.listForProject(projectId) as Note[];
    const n = list[0] ?? null;
    setNote(n);
    setText(n?.bodyMd ?? "");
  }

  async function save() {
    setEditing(false);
    if (!text.trim() && !note) return;
    setSaving(true);
    try {
      if (!note) {
        const created = await api.notes.create({ projectId, bodyMd: text }) as Note;
        setNote(created);
      } else if (text !== note.bodyMd) {
        const updated = await api.notes.update(note.id, { bodyMd: text }) as Note;
        setNote(updated);
      }
    } finally { setSaving(false); }
  }

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wide text-gray-400">Projekt-Notiz · Markdown</div>
        {!editing && text.trim() && (
          <button onClick={() => setEditing(true)} className="text-xs text-pulse inline-flex items-center gap-1 hover:underline">
            <Edit3 size={12} /> Bearbeiten
          </button>
        )}
        {editing && <div className="text-xs text-gray-400">{saving ? "…speichert" : "Klick außerhalb oder Tab zum Speichern"}</div>}
      </div>
      {editing ? (
        <textarea autoFocus value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          placeholder="Markdown-Notiz zu diesem Projekt — Specs, Links, Notizen, was auch immer…"
          className="flex-1 w-full text-sm border border-[var(--border)] rounded p-3 resize-none focus:outline-none focus:ring-2 focus:ring-pulse/40 font-mono" />
      ) : text.trim() ? (
        <div onClick={() => setEditing(true)}
          className="flex-1 overflow-y-auto cursor-text border border-transparent hover:border-[var(--border)] rounded p-3">
          <Markdown source={text} />
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          className="flex-1 text-left text-sm text-gray-400 italic border border-dashed border-[var(--border)] rounded p-6 hover:border-pulse">
          Markdown-Notiz zu diesem Projekt anfangen…
        </button>
      )}
    </div>
  );
}
