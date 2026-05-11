import { useEffect, useRef, useState } from "react";
import { Plus, X, Tag as TagIcon, ChevronLeft } from "lucide-react";
import { useTags } from "../stores/tags.js";
import { api } from "../api.js";

const TAG_COLORS: readonly string[] = [
  "#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6B7280",
];

export function TagPicker({ taskId }: { taskId: string }) {
  const allTags = useTags((s) => s.byId);
  const order = useTags((s) => s.order);
  const create = useTags((s) => s.create);
  const attach = useTags((s) => s.attach);
  const detach = useTags((s) => s.detach);

  const [taskTagIds, setTaskTagIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [creatingName, setCreatingName] = useState<string | null>(null);
  const [creatingColor, setCreatingColor] = useState(TAG_COLORS[0]!);
  const popRef = useRef<HTMLDivElement>(null);

  async function load() { setTaskTagIds(await api.tasks.tagsForTask(taskId)); }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [taskId]);
  useEffect(() => api.events.on("tags.changed", () => { void load(); }), [taskId]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) { if (popRef.current && !popRef.current.contains(e.target as Node)) { setOpen(false); setCreatingName(null); } }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function add(tagId: string) {
    if (taskTagIds.includes(tagId)) return;
    await attach(taskId, tagId);
    await load();
  }
  async function remove(tagId: string) {
    await detach(taskId, tagId);
    await load();
  }
  function startCreate(name: string) {
    setCreatingName(name);
    setCreatingColor(TAG_COLORS[order.length % TAG_COLORS.length]!);
  }
  async function commitCreate() {
    if (!creatingName?.trim()) return;
    const t = await create({ name: creatingName.trim(), color: creatingColor });
    await add(t.id);
    setCreatingName(null);
    setFilter("");
  }

  const candidates = order
    .map((id) => allTags[id]!)
    .filter((t) => !filter || t.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {taskTagIds.map((tid) => {
        const t = allTags[tid];
        if (!t) return null;
        return (
          <span key={tid}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
            style={{ background: `${t.color}22`, color: t.color }}>
            <TagIcon size={10} /> {t.name}
            <button onClick={() => void remove(tid)} className="hover:text-red-600" aria-label="Tag entfernen">
              <X size={10} />
            </button>
          </span>
        );
      })}
      <div className="relative inline-block" ref={popRef}>
        <button onClick={() => { setOpen((o) => !o); setCreatingName(null); }}
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-400 hover:text-pulse hover:border-pulse">
          <Plus size={10} /> Tag
        </button>
        {open && (
          <div className="absolute z-30 top-7 left-0 bg-white border border-[var(--border)] rounded-lg shadow-lg w-64 p-2">
            {creatingName === null ? (
              <>
                <input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && filter.trim()) startCreate(filter); }}
                  placeholder="Tag suchen…"
                  className="w-full text-sm border border-[var(--border)] rounded px-2 py-1 mb-1 focus:outline-none focus:ring-1 focus:ring-pulse/40" />
                <div className="max-h-48 overflow-y-auto">
                  {candidates.map((t) => (
                    <button key={t.id} disabled={taskTagIds.includes(t.id)}
                      onClick={() => void add(t.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1 text-sm rounded text-left ${taskTagIds.includes(t.id) ? "opacity-40 cursor-default" : "hover:bg-gray-100"}`}>
                      <span className="w-2 h-2 rounded-full" style={{ background: t.color }} /> {t.name}
                    </button>
                  ))}
                  {candidates.length === 0 && filter && (
                    <div className="text-xs text-gray-400 px-2 py-2">Kein Treffer.</div>
                  )}
                </div>
                <div className="border-t border-[var(--border)] mt-1 pt-1">
                  <button onClick={() => startCreate(filter || "")}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded text-left hover:bg-gray-100 text-pulse">
                    <Plus size={12} /> Neuer Tag {filter ? `"${filter}"` : "anlegen"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1 mb-2">
                  <button onClick={() => setCreatingName(null)} className="text-gray-400 hover:text-gray-600">
                    <ChevronLeft size={14} />
                  </button>
                  <div className="text-xs uppercase tracking-wide text-gray-400">Neuer Tag</div>
                </div>
                <input autoFocus value={creatingName}
                  onChange={(e) => setCreatingName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void commitCreate(); }}
                  placeholder="Tag-Name…"
                  className="w-full text-sm border border-[var(--border)] rounded px-2 py-1 mb-2 focus:outline-none focus:ring-1 focus:ring-pulse/40" />
                <div className="text-xs text-gray-400 mb-1">Farbe</div>
                <div className="flex gap-1.5 mb-2 flex-wrap">
                  {TAG_COLORS.map((c) => (
                    <button key={c} onClick={() => setCreatingColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition ${c.toLowerCase() === creatingColor.toLowerCase() ? "border-pulse ring-2 ring-pulse ring-offset-1" : "border-black/10 hover:border-pulse/60"}`}
                      style={{ background: c }} aria-label={c} />
                  ))}
                </div>
                <button onClick={() => void commitCreate()}
                  disabled={!creatingName.trim()}
                  className="w-full text-sm bg-pulse text-white rounded px-2 py-1.5 hover:bg-pulse-hover disabled:opacity-50">
                  Erstellen
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
