import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import type { Task } from "@pulse/core";
import { useUi } from "../stores/ui.js";
import { cn } from "../lib/cn.js";
import { PriorityBadge } from "../components/PriorityBadge.js";
import { DueDateBadge } from "../components/DueDateBadge.js";

export function KanbanColumn({ status, tasks }: { status: Task["status"]; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  const labels: Record<Task["status"], string> = { todo: "Todo", in_progress: "In Progress", done: "Done" };
  return (
    <div ref={setNodeRef}
      className={cn("flex flex-col gap-2 p-3 bg-gray-50 rounded-lg w-[280px] flex-shrink-0", isOver && "bg-blue-50 ring-1 ring-pulse")}>
      <div className="flex items-center justify-between text-sm font-medium text-gray-700">
        <span>{labels[status]}</span>
        <span className="text-xs text-gray-400">{tasks.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {tasks.map((t) => <Card key={t.id} task={t} />)}
      </div>
    </div>
  );
}

function Card({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const select = useUi((s) => s.selectTask);
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      style={style}
      onClick={() => select(task.id)}
      className={cn("bg-white rounded-md border border-[var(--border)] p-2 text-sm cursor-grab",
        isDragging && "opacity-60 cursor-grabbing")}>
      <div className="font-medium truncate">{task.title}</div>
      <div className="flex items-center justify-between mt-1">
        <PriorityBadge priority={task.priority as 1|2|3|4} />
        <DueDateBadge iso={task.dueDate} />
      </div>
    </div>
  );
}
