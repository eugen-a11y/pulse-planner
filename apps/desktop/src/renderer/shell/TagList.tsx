import { useTags } from "../stores/tags.js";

export function TagList(): JSX.Element {
  const order = useTags((s) => s.order);
  const byId = useTags((s) => s.byId);
  if (order.length === 0) return <></>;
  return (
    <div className="px-2">
      <div className="text-xs uppercase tracking-wide text-gray-400 px-2 py-1">Tags</div>
      {order.map((id) => {
        const t = byId[id]!;
        return (
          <div key={id} className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700">
            <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
            <span className="truncate">#{t.name}</span>
          </div>
        );
      })}
    </div>
  );
}
