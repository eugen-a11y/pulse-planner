import { useEffect, useRef, useState } from "react";
import { Inbox, Folder, ChevronDown } from "lucide-react";
import { useProjects } from "../stores/projects.js";

export function ProjectPicker({ value, onChange }: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const order = useProjects((s) => s.order);
  const byId = useProjects((s) => s.byId);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) { if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const projects = order
    .map((id) => byId[id])
    .filter((p): p is NonNullable<typeof p> => Boolean(p) && !p!.archived)
    .filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()));
  const current = value ? byId[value] : null;

  return (
    <div className="relative inline-block" ref={popRef}>
      <button onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-700 hover:bg-gray-100 px-2 py-1 rounded">
        {value === null
          ? <><Inbox size={12} className="text-gray-400" /> Inbox</>
          : current
            ? <><span className="w-2 h-2 rounded-full" style={{ background: current.color }} /> {current.name}</>
            : <><Folder size={12} className="text-gray-400" /> —</>}
        <ChevronDown size={12} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-30 top-8 left-0 bg-white border border-[var(--border)] rounded-lg shadow-lg w-64 p-2">
          <input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="Projekt suchen…"
            className="w-full text-sm border border-[var(--border)] rounded px-2 py-1 mb-1 focus:outline-none focus:ring-1 focus:ring-pulse/40" />
          <div className="max-h-64 overflow-y-auto">
            <button onClick={() => { onChange(null); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded text-left hover:bg-gray-100 ${value === null ? "bg-pulse/10" : ""}`}>
              <Inbox size={14} className="text-gray-400" /> Inbox
            </button>
            {projects.map((p) => (
              <button key={p.id} onClick={() => { onChange(p.id); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded text-left hover:bg-gray-100 ${value === p.id ? "bg-pulse/10" : ""}`}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} /> {p.name}
              </button>
            ))}
            {projects.length === 0 && filter && (
              <div className="text-xs text-gray-400 px-2 py-2">Kein Treffer.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
