import type { Task } from "@pulse/core";
import { useTasks } from "../stores/tasks.js";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { ProjectPicker } from "../components/ProjectPicker.js";
import { RecurrenceField } from "../components/RecurrenceField.js";
import { TagPicker } from "../components/TagPicker.js";

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
      <Row label="Projekt">
        <ProjectPicker value={task.projectId}
          onChange={(projectId) => void update(task.id, { projectId })} />
      </Row>
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
          type="datetime-local"
          className="bg-transparent"
          value={task.dueDate ? format(parseISO(task.dueDate), "yyyy-MM-dd'T'HH:mm", { locale: de }) : ""}
          onChange={(e) => {
            const v = e.target.value;
            const iso = v ? new Date(v).toISOString() : null;
            void update(task.id, { dueDate: iso });
          }}
        />
      </Row>
      <Row label="Wiederholt">
        <RecurrenceField value={task.recurrenceRule}
          onChange={(recurrenceRule) => void update(task.id, { recurrenceRule })} />
      </Row>
      <Row label="Tags">
        <TagPicker taskId={task.id} />
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 min-h-[28px]">
      <div className="w-20 text-xs uppercase text-gray-400 pt-1.5">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
