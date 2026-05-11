import { useState } from "react";
import { Plus, ChevronRight, ChevronDown, Archive } from "lucide-react";
import { useProjects } from "../stores/projects.js";
import { useUi } from "../stores/ui.js";
import { Input } from "../components/ui/input.js";
import { useToasts } from "../components/ui/toast.js";
import { cn } from "../lib/cn.js";

export function ProjectList(): JSX.Element {
  const order = useProjects((s) => s.order);
  const byId = useProjects((s) => s.byId);
  const create = useProjects((s) => s.create);
  const view = useUi((s) => s.currentView);
  const setView = useUi((s) => s.setView);
  const push = useToasts((s) => s.push);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);

  const active = order.map((id) => byId[id]!).filter((p) => p && !p.archived);
  const archived = order.map((id) => byId[id]!).filter((p) => p && p.archived);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await create({ name: name.trim() });
      setName(""); setAdding(false);
    } catch (err) { push((err as Error).message, "error"); }
  }

  return (
    <div className="px-2">
      <div className="flex items-center justify-between px-2 py-1">
        <div className="text-xs uppercase tracking-wide text-gray-400">Projects</div>
        <button className="text-gray-400 hover:text-pulse" onClick={() => setAdding(true)} aria-label="Neues Projekt">
          <Plus size={14} />
        </button>
      </div>
      {active.map((p) => <Row key={p.id} project={p} active={view.kind === "project" && view.projectId === p.id} onClick={() => setView({ kind: "project", projectId: p.id })} />)}
      {adding && (
        <form onSubmit={submit} className="px-2 pt-1">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setAdding(false)} placeholder="Projektname" />
        </form>
      )}
      {archived.length > 0 && (
        <>
          <button onClick={() => setArchiveOpen((o) => !o)}
            className="flex items-center gap-1 px-2 py-1 mt-2 text-xs uppercase tracking-wide text-gray-400 hover:text-gray-600 w-full text-left">
            {archiveOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Archive size={12} /> Archiv ({archived.length})
          </button>
          {archiveOpen && archived.map((p) => (
            <Row key={p.id} project={p} active={view.kind === "project" && view.projectId === p.id}
              onClick={() => setView({ kind: "project", projectId: p.id })} muted />
          ))}
        </>
      )}
    </div>
  );
}

function Row({ project, active, onClick, muted }: {
  project: { id: string; name: string; color: string };
  active: boolean; onClick: () => void; muted?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded text-sm w-full text-left",
        active ? "bg-pulse text-white" : "text-gray-700 hover:bg-white",
        muted && !active && "opacity-50",
      )}>
      <span className="w-2 h-2 rounded-full" style={{ background: project.color }} />
      <span className="truncate">{project.name}</span>
    </button>
  );
}
