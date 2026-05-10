import { Calendar } from "lucide-react";
import { useTasks } from "../stores/tasks.js";
import { TaskRowItem } from "../components/TaskRowItem.js";
import { EmptyState } from "../components/EmptyState.js";

export function UpcomingView(): JSX.Element {
  const ids = useTasks((s) => s.upcomingIds);
  const byId = useTasks((s) => s.byId);
  const tasks = ids.map((i) => byId[i]).filter(Boolean);
  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-[var(--border)]">
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Calendar className="text-pulse" size={22} /> Upcoming</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        {tasks.length === 0
          ? <EmptyState icon={<Calendar size={32} />} title="Keine Tasks in den nächsten 7 Tagen." />
          : <div className="space-y-1.5">{tasks.map((t) => <TaskRowItem key={t!.id} task={t!} showProject />)}</div>}
      </div>
    </div>
  );
}
