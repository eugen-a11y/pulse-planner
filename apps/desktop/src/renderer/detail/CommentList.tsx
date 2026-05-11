import { useEffect, useState } from "react";
import type { Task, Comment } from "@pulse/core";
import { api } from "../api.js";
import { Input } from "../components/ui/input.js";
import { Markdown } from "../components/Markdown.js";
import { formatDateTime } from "../lib/format.js";

export function CommentList({ task }: { task: Task }) {
  const [items, setItems] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");

  async function load() { setItems(await api.comments.listForTask(task.id) as Comment[]); }
  useEffect(() => { void load(); }, [task.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    await api.comments.create({ taskId: task.id, bodyMd: draft.trim() });
    setDraft(""); await load();
  }

  return (
    <div>
      <div className="text-xs uppercase text-gray-400 mb-1">Kommentare</div>
      <div className="space-y-2 mb-2">
        {items.map((c) => (
          <div key={c.id} className="text-sm bg-gray-50 p-2 rounded">
            <div className="text-xs text-gray-400 mb-0.5">{formatDateTime(c.createdAt)}</div>
            <Markdown source={c.bodyMd} />
          </div>
        ))}
      </div>
      <form onSubmit={submit}>
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Kommentar hinzufügen…" />
      </form>
    </div>
  );
}
