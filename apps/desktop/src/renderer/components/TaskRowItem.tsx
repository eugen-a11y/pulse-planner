import { X } from "lucide-react";
import type { Task } from "@pulse/core";
import { useUi } from "../stores/ui.js";
import { useTasks } from "../stores/tasks.js";
import { PriorityBadge } from "./PriorityBadge.js";
import { DueDateBadge } from "./DueDateBadge.js";
import { ProjectChip } from "./ProjectChip.js";
import { cn } from "../lib/cn.js";

export function TaskRowItem({ task, showProject }: { task: Task; showProject?: boolean }) {
  const selectedId = useUi((s) => s.selectedTaskId);
  const select = useUi((s) => s.selectTask);
  const closeDetail = useUi((s) => s.closeDetail);
  const complete = useTasks((s) => s.complete);
  const update = useTasks((s) => s.update);
  const remove = useTasks((s) => s.remove);

  return (
    <div
      onClick={() => select(task.id)}
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded border cursor-pointer",
        selectedId === task.id ? "border-pulse bg-pulse/5" : "border-[var(--border)] hover:bg-gray-50",
      )}
    >
      <input
        type="checkbox"
        checked={task.status === "done"}
        onClick={(e) => e.stopPropagation()}
        onChange={() => {
          if (task.status === "done") void update(task.id, { status: "todo", completedAt: null });
          else void complete(task.id);
        }}
        className="w-4 h-4 accent-pulse"
      />
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={cn("text-sm truncate", task.status === "done" && "line-through text-gray-400")}>
          {task.title}
        </span>
        <PriorityBadge priority={task.priority as 1 | 2 | 3 | 4} />
      </div>
      <div className="flex items-center gap-3">
        <DueDateBadge iso={task.dueDate} />
        {showProject && <ProjectChip projectId={task.projectId} />}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!confirm(`Task "${task.title}" löschen?`)) return;
            if (selectedId === task.id) closeDetail();
            void remove(task.id);
          }}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-600 transition"
          aria-label="Task löschen"
          title="Task löschen">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
