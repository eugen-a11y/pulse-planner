import { Star } from "lucide-react";
import { useTasks } from "../stores/tasks.js";
import { TaskRowItem } from "../components/TaskRowItem.js";
import { EmptyState } from "../components/EmptyState.js";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export function TodayView(): JSX.Element {
  const ids = useTasks((s) => s.todayIds);
  const byId = useTasks((s) => s.byId);
  const tasks = ids.map((i) => byId[i]).filter(Boolean);

  const overdue = tasks.filter((t) => t!.dueDate && t!.dueDate < new Date(new Date().setHours(0,0,0,0)).toISOString());
  const today = tasks.filter((t) => !overdue.includes(t!));

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-[var(--border)]">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Star className="text-pulse" size={22} /> Heute · {format(new Date(), "EEEE", { locale: de })}
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {tasks.length === 0 && (
          <EmptyState icon={<Star size={32} />} title="Nichts mehr für heute. Schön." />
        )}
        {overdue.length > 0 && (
          <section>
            <div className="text-xs uppercase tracking-wide text-red-600 mb-2">Überfällig</div>
            <div className="space-y-1.5">{overdue.map((t) => <TaskRowItem key={t!.id} task={t!} showProject />)}</div>
          </section>
        )}
        {today.length > 0 && (
          <section>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Heute fällig</div>
            <div className="space-y-1.5">{today.map((t) => <TaskRowItem key={t!.id} task={t!} showProject />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
