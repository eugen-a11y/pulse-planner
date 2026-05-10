import { useProjects } from "../stores/projects.js";

export function ProjectChip({ projectId }: { projectId: string }) {
  const project = useProjects((s) => s.byId[projectId]);
  if (!project) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
      <span className="w-2 h-2 rounded-full" style={{ background: project.color }} />
      {project.name}
    </span>
  );
}
