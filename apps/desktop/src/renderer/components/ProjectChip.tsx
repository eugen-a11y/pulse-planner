import { Inbox } from "lucide-react";
import { useProjects } from "../stores/projects.js";

export function ProjectChip({ projectId }: { projectId: string | null }) {
  const project = useProjects((s) => (projectId ? s.byId[projectId] : undefined));
  if (projectId === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <Inbox size={10} /> Inbox
      </span>
    );
  }
  if (!project) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
      <span className="w-2 h-2 rounded-full" style={{ background: project.color }} />
      {project.name}
    </span>
  );
}
