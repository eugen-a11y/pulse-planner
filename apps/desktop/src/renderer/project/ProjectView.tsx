import { useState } from "react";
import { LayoutList, KanbanSquare } from "lucide-react";
import { useProjects } from "../stores/projects.js";
import { ListView } from "./ListView.js";
import { KanbanView } from "./KanbanView.js";
import { cn } from "../lib/cn.js";

export function ProjectView({ projectId }: { projectId: string }) {
  const project = useProjects((s) => s.byId[projectId]);
  const [mode, setMode] = useState<"list" | "kanban">("list");

  if (!project) return <div className="p-6 text-gray-500">Project nicht gefunden.</div>;

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full" style={{ background: project.color }} />
          <h1 className="text-2xl font-semibold">{project.name}</h1>
        </div>
        <div className="flex gap-1">
          <button className={cn("p-2 rounded", mode === "list" ? "bg-pulse text-white" : "text-gray-500 hover:bg-gray-100")}
            onClick={() => setMode("list")} aria-label="Liste"><LayoutList size={16} /></button>
          <button className={cn("p-2 rounded", mode === "kanban" ? "bg-pulse text-white" : "text-gray-500 hover:bg-gray-100")}
            onClick={() => setMode("kanban")} aria-label="Kanban"><KanbanSquare size={16} /></button>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        {mode === "list"
          ? <ListView projectId={projectId} />
          : <KanbanView projectId={projectId} />}
      </div>
    </div>
  );
}
