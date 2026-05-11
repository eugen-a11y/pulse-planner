import { useEffect, useMemo, useRef, useState } from "react";
import { Search, FileText, CheckSquare, Folder } from "lucide-react";
import { useTasks } from "../stores/tasks.js";
import { useProjects } from "../stores/projects.js";
import { useUi } from "../stores/ui.js";

type Hit =
  | { kind: "task"; id: string; title: string; projectId: string | null; rank: number }
  | { kind: "project"; id: string; name: string; rank: number };

export function SearchPalette(): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const tasksById = useTasks((s) => s.byId);
  const projectsById = useProjects((s) => s.byId);
  const setView = useUi((s) => s.setView);
  const selectTask = useUi((s) => s.selectTask);

  // Global Ctrl+K hotkey
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => { if (open) { setQuery(""); setActiveIdx(0); inputRef.current?.focus(); } }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Hit[] = [];
    for (const t of Object.values(tasksById)) {
      if (t.deletedAt) continue;
      const title = t.title.toLowerCase();
      const r = rank(title, q);
      if (r > 0) out.push({ kind: "task", id: t.id, title: t.title, projectId: t.projectId, rank: r });
    }
    for (const p of Object.values(projectsById)) {
      if (p.deletedAt) continue;
      const name = p.name.toLowerCase();
      const r = rank(name, q);
      if (r > 0) out.push({ kind: "project", id: p.id, name: p.name, rank: r + 1 });
    }
    out.sort((a, b) => b.rank - a.rank);
    return out.slice(0, 30);
  }, [query, tasksById, projectsById]);

  function go(hit: Hit) {
    if (hit.kind === "task") {
      if (hit.projectId) setView({ kind: "project", projectId: hit.projectId });
      else setView({ kind: "inbox" });
      // selectTask after a tick so the view has mounted and DetailPane can pick it up
      setTimeout(() => selectTask(hit.id), 0);
    } else {
      setView({ kind: "project", projectId: hit.id });
    }
    setOpen(false);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-24"
      onClick={() => setOpen(false)}>
      <div className="bg-white w-[600px] max-w-[90vw] rounded-lg shadow-xl border border-[var(--border)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
          <Search size={16} className="text-gray-400" />
          <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(hits.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === "Enter" && hits[activeIdx]) { e.preventDefault(); go(hits[activeIdx]!); }
            }}
            placeholder="Suche Tasks, Projekte… (Esc schließt)"
            className="flex-1 text-sm focus:outline-none" />
          <kbd className="text-xs text-gray-400 border border-[var(--border)] rounded px-1">Esc</kbd>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {hits.length === 0 && query && (
            <div className="text-sm text-gray-400 p-6 text-center">Kein Treffer für "{query}"</div>
          )}
          {hits.length === 0 && !query && (
            <div className="text-sm text-gray-400 p-6 text-center">Tippe um zu suchen — über alle Tasks und Projekte</div>
          )}
          {hits.map((h, i) => (
            <button key={`${h.kind}:${h.id}`} onClick={() => go(h)}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm ${i === activeIdx ? "bg-pulse/10" : "hover:bg-gray-50"}`}>
              {h.kind === "task"
                ? <CheckSquare size={14} className="text-gray-400 flex-shrink-0" />
                : <Folder size={14} className="text-gray-400 flex-shrink-0" />}
              <span className="flex-1 truncate">{h.kind === "task" ? h.title : h.name}</span>
              <span className="text-xs text-gray-400">
                {h.kind === "task" ? (h.projectId ? projectsById[h.projectId]?.name ?? "—" : "Inbox") : "Projekt"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function rank(haystack: string, needle: string): number {
  if (haystack === needle) return 100;
  if (haystack.startsWith(needle)) return 50;
  const idx = haystack.indexOf(needle);
  if (idx === 0) return 50;
  if (idx > 0) return 25 - Math.min(idx, 20);
  return 0;
}
