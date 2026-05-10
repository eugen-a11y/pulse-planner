import { useEffect, useState } from "react";
import type { Note } from "@pulse/core";
import { api } from "../api.js";

export function ProjectNotesView({ projectId }: { projectId: string }) {
  const [note, setNote] = useState<Note | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);
  async function load() {
    const list = await api.notes.listForProject(projectId) as Note[];
    const n = list[0] ?? null;
    setNote(n);
    setText(n?.bodyMd ?? "");
  }

  async function save() {
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
      <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Projekt-Notiz · Markdown</div>
      <textarea value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        placeholder="Markdown-Notiz zu diesem Projekt — Specs, Links, Notizen, was auch immer…"
        className="flex-1 w-full text-sm border border-[var(--border)] rounded p-3 resize-none focus:outline-none focus:ring-2 focus:ring-pulse/40 font-mono" />
      <div className="text-xs text-gray-400 mt-1 text-right">{saving ? "…speichert" : "automatisch beim Verlassen gespeichert"}</div>
    </div>
  );
}
