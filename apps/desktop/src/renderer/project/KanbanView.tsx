import { useEffect } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { Task } from "@pulse/core";
import { useTasks } from "../stores/tasks.js";
import { KanbanColumn } from "./KanbanColumn.js";

const STATUSES: Task["status"][] = ["todo", "in_progress", "done"];
const EMPTY_IDS: readonly string[] = [];

export function KanbanView({ projectId }: { projectId: string }) {
  const ids = useTasks((s) => s.byProject[projectId]) ?? EMPTY_IDS;
  const byId = useTasks((s) => s.byId);
  const refresh = useTasks((s) => s.refreshProject);
  const update = useTasks((s) => s.update);

  // Without an activation distance, dnd-kit eats the click handler on the card
  // (drag starts immediately on pointer-down). 8 px lets a tap fire `onClick`
  // — handled in KanbanColumn → useUi.selectTask — while a real drag still works.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => { void refresh(projectId); }, [projectId, refresh]);
  const tasks = ids.map((i) => byId[i]).filter(Boolean) as Task[];

  // Done column shows last 7 days only (per spec).
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const cols: Record<Task["status"], Task[]> = {
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    done: tasks.filter((t) => t.status === "done" && (t.completedAt ?? t.updatedAt) >= sevenDaysAgo),
  };

  function onDragEnd(e: DragEndEvent) {
    const overId = e.over?.id?.toString();
    if (!overId?.startsWith("col:")) return;
    const newStatus = overId.slice(4) as Task["status"];
    const taskId = e.active.id.toString();
    const task = byId[taskId];
    if (!task || task.status === newStatus) return;
    void update(taskId, { status: newStatus });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="h-full overflow-x-auto p-4 flex gap-4">
        {STATUSES.map((s) => <KanbanColumn key={s} status={s} tasks={cols[s]} />)}
      </div>
    </DndContext>
  );
}
