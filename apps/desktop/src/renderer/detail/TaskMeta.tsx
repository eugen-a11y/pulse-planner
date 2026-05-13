import type { Task } from "@pulse/core";
import { useTasks } from "../stores/tasks.js";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { ProjectPicker } from "../components/ProjectPicker.js";
import { RecurrenceField } from "../components/RecurrenceField.js";
import { TagPicker } from "../components/TagPicker.js";

const PRIORITIES: Array<{ value: 1 | 2 | 3; label: string }> = [
  { value: 1, label: "!!! Hoch" },
  { value: 2, label: "!! Mittel" },
  { value: 3, label: "! Niedrig" },
];

// Mirrors apps/mobile/src/components/ReminderPicker PRESETS. Kept inline for
// now; promote to @pulse/core if a third surface ever needs it.
const REMINDER_PRESETS: Array<{ value: number | null; label: string }> = [
  { value: null,  label: "Aus" },
  { value: 0,     label: "Zum Ereignis" },
  { value: 5,     label: "5 min vorher" },
  { value: 10,    label: "10 min vorher" },
  { value: 15,    label: "15 min vorher" },
  { value: 30,    label: "30 min vorher" },
  { value: 60,    label: "1 Stunde vorher" },
  { value: 120,   label: "2 Stunden vorher" },
  { value: 180,   label: "3 Stunden vorher" },
  { value: 360,   label: "6 Stunden vorher" },
  { value: 720,   label: "12 Stunden vorher" },
  { value: 1440,  label: "1 Tag vorher" },
  { value: 2880,  label: "2 Tage vorher" },
  { value: 10080, label: "1 Woche vorher" },
];

function reminderKey(v: number | null): string {
  return v === null ? "off" : String(v);
}
function reminderFromKey(k: string): number | null {
  if (k === "off") return null;
  const n = Number(k);
  return Number.isFinite(n) ? n : null;
}

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
          onChange={(e) => void update(task.id, { priority: Number(e.target.value) as 1|2|3 })}>
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
            // Clearing the due date also clears the reminder so we don't
            // leave a dangling offset that would never fire. Mirrors mobile.
            if (iso === null && task.reminderOffsetMinutes !== null) {
              void update(task.id, { dueDate: null, reminderOffsetMinutes: null });
            } else {
              void update(task.id, { dueDate: iso });
            }
          }}
        />
      </Row>
      <Row label="Erinnerung">
        <select
          className="bg-transparent"
          value={reminderKey(task.reminderOffsetMinutes)}
          disabled={!task.dueDate}
          title={task.dueDate ? undefined : "Erst Fälligkeit setzen"}
          onChange={(e) => void update(task.id, { reminderOffsetMinutes: reminderFromKey(e.target.value) })}
        >
          {REMINDER_PRESETS.map((p) => (
            <option key={reminderKey(p.value)} value={reminderKey(p.value)}>{p.label}</option>
          ))}
        </select>
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
