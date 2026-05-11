import { useState, useEffect, useRef, useMemo } from "react";
import { LayoutList, KanbanSquare, FileText, X, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useProjects } from "../stores/projects.js";
import { useTasks } from "../stores/tasks.js";
import { useUi } from "../stores/ui.js";
import { ListView } from "./ListView.js";
import { KanbanView } from "./KanbanView.js";
import { ProjectNotesView } from "./ProjectNotesView.js";
import { ColorSwatch } from "../components/ColorSwatch.js";
import { Markdown } from "../components/Markdown.js";
import { cn } from "../lib/cn.js";

type Mode = "list" | "kanban" | "notes";

export function ProjectView({ projectId }: { projectId: string }) {
  const project = useProjects((s) => s.byId[projectId]);
  const update = useProjects((s) => s.update);
  const remove = useProjects((s) => s.remove);
  const setView = useUi((s) => s.setView);
  const tasks = useTasks((s) => s.byProject[projectId] ?? EMPTY);
  const byId = useTasks((s) => s.byId);
  const [mode, setMode] = useState<Mode>("list");

  const { done, total, percent } = useMemo(() => {
    const ofProj = tasks.map((id) => byId[id]).filter(Boolean);
    const total = ofProj.length;
    const done = ofProj.filter((t) => t!.status === "done").length;
    return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
  }, [tasks, byId]);

  if (!project) return <div className="p-6 text-gray-500">Project nicht gefunden.</div>;

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-[var(--border)] space-y-3">
        <div className="flex items-center gap-3">
          <ColorSwatch value={project.color} onChange={(color) => void update(project.id, { color })} />
          <EditableName value={project.name} onSave={(name) => void update(project.id, { name })} />
          <div className="ml-auto flex items-center gap-1">
            {project.archived ? (
              <button onClick={async () => { await update(project.id, { archived: false }); }}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-pulse px-2 py-1 rounded hover:bg-gray-100"
                title="Wiederherstellen">
                <ArchiveRestore size={14} /> Wiederherstellen
              </button>
            ) : (
              <button onClick={async () => {
                if (!confirm(`Projekt "${project.name}" archivieren? Es verschwindet aus der Sidebar; Tasks bleiben erhalten.`)) return;
                await update(project.id, { archived: true });
                setView({ kind: "dashboard" });
              }}
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-pulse px-2 py-1 rounded hover:bg-gray-100"
                title="Archivieren">
                <Archive size={14} /> Archivieren
              </button>
            )}
            <button onClick={async () => {
              if (!confirm(`Projekt "${project.name}" wirklich löschen? Alle zugehörigen Tasks, Notizen und Anhänge werden mitentfernt. Aktion ist via DB-Restore rückholbar, aber nicht aus der UI.`)) return;
              await remove(project.id);
              setView({ kind: "dashboard" });
            }}
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded hover:bg-gray-100"
              title="Projekt löschen">
              <Trash2 size={14} /> Löschen
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <DueDateField iso={project.dueDate} onChange={(dueDate) => void update(project.id, { dueDate })} />
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Fortschritt</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: project.color }} />
            </div>
            <span className="text-xs text-gray-500 tabular-nums w-20 text-right">{done}/{total} · {percent}%</span>
          </div>
        </div>

        <DescriptionField value={project.description} onChange={(description) => void update(project.id, { description })} />

        <div className="flex gap-1 pt-1">
          <Tab active={mode === "list"}   onClick={() => setMode("list")}   icon={<LayoutList size={14} />}   label="Liste" />
          <Tab active={mode === "kanban"} onClick={() => setMode("kanban")} icon={<KanbanSquare size={14} />} label="Kanban" />
          <Tab active={mode === "notes"}  onClick={() => setMode("notes")}  icon={<FileText size={14} />}     label="Notizen" />
        </div>
      </header>

      <div className="flex-1 min-h-0">
        {mode === "list"   && <ListView projectId={projectId} />}
        {mode === "kanban" && <KanbanView projectId={projectId} />}
        {mode === "notes"  && <ProjectNotesView projectId={projectId} />}
      </div>
    </div>
  );
}

const EMPTY: readonly string[] = [];

function EditableName({ value, onSave }: { value: string; onSave: (next: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onSave(next);
    else setDraft(value);
  }

  if (!editing) {
    return (
      <h1 className="text-2xl font-semibold cursor-text hover:bg-gray-50 rounded px-1 -mx-1"
        onClick={() => setEditing(true)} title="Klicken zum Umbenennen">
        {value}
      </h1>
    );
  }
  return (
    <input ref={inputRef} value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
      className="text-2xl font-semibold bg-white border border-pulse rounded px-1 -mx-1 focus:outline-none" />
  );
}

function DueDateField({ iso, onChange }: { iso: string | null; onChange: (next: string | null) => void }) {
  const value = iso ? format(parseISO(iso), "yyyy-MM-dd'T'HH:mm", { locale: de }) : "";
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-gray-400 uppercase tracking-wide">Fällig</span>
      <input type="datetime-local" value={value}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        className="text-xs bg-transparent border border-[var(--border)] rounded px-2 py-1" />
      {iso && (
        <button onClick={() => onChange(null)} aria-label="Fälligkeit löschen"
          className="text-gray-400 hover:text-red-600"><X size={12} /></button>
      )}
    </label>
  );
}

function DescriptionField({ value, onChange }: { value: string | null; onChange: (next: string | null) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  const [editing, setEditing] = useState(false);
  useEffect(() => { setDraft(value ?? ""); }, [value]);

  function commit() {
    setEditing(false);
    if (draft.trim() === (value ?? "")) return;
    onChange(draft.trim() || null);
  }

  if (editing) {
    return (
      <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        placeholder="Beschreibung — Markdown erlaubt…"
        maxLength={2000} rows={3}
        className="w-full text-sm bg-transparent border border-[var(--border)] rounded p-2 focus:outline-none focus:ring-2 focus:ring-pulse/30 resize-none font-mono" />
    );
  }
  if (value && value.trim()) {
    return (
      <div onClick={() => setEditing(true)} className="cursor-text border border-transparent hover:border-[var(--border)] rounded p-2 -m-2">
        <Markdown source={value} className="text-sm" />
      </div>
    );
  }
  return (
    <button onClick={() => setEditing(true)}
      className="w-full text-left text-xs text-gray-400 italic border border-dashed border-[var(--border)] rounded p-2 hover:border-pulse">
      Beschreibung — was ist das Ziel dieses Projekts? (Markdown erlaubt)
    </button>
  );
}

function Tab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: JSX.Element; label: string }) {
  return (
    <button onClick={onClick}
      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium",
        active ? "bg-pulse text-white" : "text-gray-500 hover:bg-gray-100")}>
      {icon} {label}
    </button>
  );
}
