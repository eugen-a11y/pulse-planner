import { useEffect, useState } from "react";
import { Play, Square } from "lucide-react";
import type { Task, TimeEntry } from "@pulse/core";
import { api } from "../api.js";
import { useTimer } from "../stores/timer.js";
import { Button } from "../components/ui/button.js";
import { formatHms, formatDateTime } from "../lib/format.js";

export function TimeEntryList({ task }: { task: Task }) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const current = useTimer((s) => s.current);
  const refresh = useTimer((s) => s.refresh);
  const isActive = current?.taskId === task.id;

  async function load() { setEntries(await api.time_entries.listForTask(task.id) as TimeEntry[]); }
  useEffect(() => { void load(); void refresh(); }, [task.id, refresh]);

  async function toggle() {
    if (isActive) await api.time_entries.stop();
    else await api.time_entries.start(task.id);
    await refresh(); await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase text-gray-400">Time-Entries</div>
        <Button size="sm" variant={isActive ? "danger" : "secondary"} onClick={toggle}>
          {isActive ? <><Square size={12} className="mr-1" />Stop</> : <><Play size={12} className="mr-1" />Start</>}
        </Button>
      </div>
      <div className="space-y-1 text-sm">
        {entries.map((e) => (
          <div key={e.id} className="flex justify-between text-xs text-gray-600">
            <span>{formatDateTime(e.startedAt)}</span>
            <span>{e.durationSeconds !== null ? formatHms(e.durationSeconds) : "läuft…"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
