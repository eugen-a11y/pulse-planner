import { X } from "lucide-react";
import { useTags } from "../stores/tags.js";
import { useUi } from "../stores/ui.js";
import { cn } from "../lib/cn.js";

export function TagList(): JSX.Element {
  const order = useTags((s) => s.order);
  const byId = useTags((s) => s.byId);
  const remove = useTags((s) => s.remove);
  const view = useUi((s) => s.currentView);
  const setView = useUi((s) => s.setView);
  if (order.length === 0) return <></>;
  return (
    <div className="px-2">
      <div className="text-xs uppercase tracking-wide text-gray-400 px-2 py-1">Tags</div>
      {order.map((id) => {
        const t = byId[id]!;
        const active = view.kind === "tag" && view.tagId === id;
        return (
          <div key={id}
            className={cn("group flex items-center gap-2 px-2 py-1.5 rounded text-sm",
              active ? "bg-pulse text-white" : "text-gray-700 hover:bg-white")}>
            <button onClick={() => setView({ kind: "tag", tagId: id })}
              className="flex-1 flex items-center gap-2 text-left min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
              <span className="truncate">#{t.name}</span>
            </button>
            <button
              onClick={() => {
                if (!confirm(`Tag "#${t.name}" löschen? Die Verknüpfung zu allen Tasks wird entfernt.`)) return;
                if (active) setView({ kind: "dashboard" });
                void remove(id);
              }}
              className={cn("opacity-0 group-hover:opacity-100 transition",
                active ? "text-white/60 hover:text-white" : "text-gray-300 hover:text-red-600")}
              aria-label="Tag löschen" title="Tag löschen">
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
