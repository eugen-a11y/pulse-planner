import type { Task } from "@pulse/core";
import { useTasks } from "../stores/tasks.js";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

const PRIORITIES: Array<{ value: 1 | 2 | 3 | 4; label: string }> = [
  { value: 1, label: "▲▲▲ Hoch" },
  { value: 2, label: "▲▲ Mittel" },
  { value: 3, label: "▲ Normal" },
  { value: 4, label: "· Niedrig" },
];

export function TaskMeta({ task }: { task: Task }) {
  const update = useTasks((s) => s.update);
  return (
    <div className="space-y-2 text-sm">
      <Row label="Status">
        <select className="bg-transparent" value={task.status}
          onChange={(e) => void update(task.id, { status: e.target.value as Task["status"] })}>
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </Row>
      <Row label="Priorität">
        <select className="bg-transparent" value={task.priority}
          onChange={(e) => void update(task.id, { priority: Number(e.target.value) as 1|2|3|4 })}>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Row>
      <Row label="Fällig">
        <input
          type="date"
          className="bg-transparent"
          value={task.dueDate ? format(parseISO(task.dueDate), "yyyy-MM-dd", { locale: de }) : ""}
          onChange={(e) => {
            const v = e.target.value;
            const iso = v ? new Date(v + "T09:00:00").toISOString() : null;
            void update(task.id, { dueDate: iso });
          }}
        />
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-xs uppercase text-gray-400">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
