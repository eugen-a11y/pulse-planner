import { useEffect, useState } from "react";
import { Square } from "lucide-react";
import { useTimer } from "../stores/timer.js";
import { useTasks } from "../stores/tasks.js";
import { api } from "../api.js";
import { elapsedSeconds, formatHms } from "../lib/format.js";

export function TopBarPill(): JSX.Element | null {
  const current = useTimer((s) => s.current);
  const refresh = useTimer((s) => s.refresh);
  const task = useTasks((s) => current ? s.byId[current.taskId] : undefined);
  const [tick, setTick] = useState(0);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!current) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [current]);

  if (!current) return null;
  const seconds = elapsedSeconds(current.startedAt);

  async function stop() {
    await api.time_entries.stop();
    await refresh();
  }

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-pulse text-white px-3 py-1.5 rounded-full shadow-md text-sm">
      <span className="font-mono tabular-nums">⏱ {formatHms(seconds)}</span>
      <span className="opacity-90 max-w-[280px] truncate">{task?.title ?? current.taskId}</span>
      <button onClick={stop} className="hover:bg-white/20 rounded-full p-0.5" aria-label="Stop">
        <Square size={12} />
      </button>
      <span className="hidden">{tick}</span>
    </div>
  );
}
