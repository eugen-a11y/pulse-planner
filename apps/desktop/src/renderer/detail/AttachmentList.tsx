import { useEffect, useState } from "react";
import { Paperclip, X } from "lucide-react";
import type { Task, Attachment } from "@pulse/core";
import { api } from "../api.js";
import { useToasts } from "../components/ui/toast.js";

export function AttachmentList({ task }: { task: Task }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const push = useToasts((s) => s.push);

  async function load() { setItems(await api.attachments.listForTask(task.id) as Attachment[]); }
  useEffect(() => { void load(); }, [task.id]);

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    for (const file of Array.from(e.dataTransfer.files)) {
      const localPath = (file as unknown as { path?: string }).path;
      if (!localPath) { push("Drop fehlgeschlagen — Pfad nicht verfügbar", "error"); continue; }
      try {
        await api.attachments.upload({ taskId: task.id, localPath });
      } catch (err) { push((err as Error).message, "error"); }
    }
    await load();
  }

  async function remove(id: string) {
    await api.attachments.delete(id);
    await load();
  }

  return (
    <div onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <div className="flex items-center gap-1 text-xs uppercase text-gray-400 mb-1"><Paperclip size={12} /> Anhänge</div>
      <div className="space-y-1">
        {items.length === 0 && (
          <div className="text-xs text-gray-400 border border-dashed border-[var(--border)] rounded p-3 text-center">
            Datei hier reinziehen
          </div>
        )}
        {items.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">{a.filename}</span>
            <span className="text-xs text-gray-400">{Math.round(a.sizeBytes / 1024)} KB</span>
            <button onClick={() => void remove(a.id)} aria-label="Löschen" className="text-gray-400 hover:text-red-600"><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
