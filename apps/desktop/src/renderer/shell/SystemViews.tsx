import { Star, Calendar, Inbox } from "lucide-react";
import { useUi } from "../stores/ui.js";
import { useTasks } from "../stores/tasks.js";
import { cn } from "../lib/cn.js";

export function SystemViews(): JSX.Element {
  const view = useUi((s) => s.currentView);
  const setView = useUi((s) => s.setView);
  const todayCount = useTasks((s) => s.todayIds.length);
  const upcomingCount = useTasks((s) => s.upcomingIds.length);

  return (
    <div className="flex flex-col px-2">
      <Item active={view.kind === "today"} onClick={() => setView({ kind: "today" })}
        icon={<Star size={16} />} label="Today" count={todayCount} />
      <Item active={view.kind === "upcoming"} onClick={() => setView({ kind: "upcoming" })}
        icon={<Calendar size={16} />} label="Upcoming" count={upcomingCount} />
      <Item active={false} onClick={() => {/* Inbox view = tasks without project; deferred to v1.x */}}
        icon={<Inbox size={16} />} label="Inbox" />
    </div>
  );
}

function Item({ active, onClick, icon, label, count }: {
  active: boolean; onClick: () => void; icon: JSX.Element; label: string; count?: number;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded text-sm w-full text-left",
        active ? "bg-pulse text-white" : "text-gray-700 hover:bg-white",
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={cn("text-xs px-1.5 rounded", active ? "bg-pulse-hover" : "bg-gray-200 text-gray-700")}>
          {count}
        </span>
      )}
    </button>
  );
}
