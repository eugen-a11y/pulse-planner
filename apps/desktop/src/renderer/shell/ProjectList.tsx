import { useState } from "react";
import { Plus } from "lucide-react";
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
      {order.map((id) => {
        const p = byId[id]!;
        const active = view.kind === "project" && view.projectId === id;
        return (
          <button key={id}
            onClick={() => setView({ kind: "project", projectId: id })}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded text-sm w-full text-left",
              active ? "bg-pulse text-white" : "text-gray-700 hover:bg-white",
            )}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="truncate">{p.name}</span>
          </button>
        );
      })}
      {adding && (
        <form onSubmit={submit} className="px-2 pt-1">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setAdding(false)} placeholder="Projektname" />
        </form>
      )}
    </div>
  );
}
