import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { useTasks } from "../stores/tasks.js";
import { TaskRowItem } from "../components/TaskRowItem.js";
import { EmptyState } from "../components/EmptyState.js";
import { Input } from "../components/ui/input.js";
import { useToasts } from "../components/ui/toast.js";

const EMPTY: readonly string[] = [];

export function InboxView(): JSX.Element {
  const ids = useTasks((s) => s.inboxIds);
  const byId = useTasks((s) => s.byId);
  const create = useTasks((s) => s.create);
  const refresh = useTasks((s) => s.refreshInbox);
  const push = useToasts((s) => s.push);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => { void refresh(); }, [refresh]);

  const tasks = (ids ?? EMPTY).map((i) => byId[i]).filter(Boolean);
  const open = tasks.filter((t) => t!.status !== "done");
  const done = tasks.filter((t) => t!.status === "done");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await create({ projectId: null, title: newTitle.trim() });
      setNewTitle("");
    } catch (err) { push((err as Error).message, "error"); }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-[var(--border)]">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Inbox className="text-pulse" size={22} /> Inbox
        </h1>
        <div className="text-xs text-gray-500 mt-1">Tasks ohne Projekt-Zuweisung. Quick Add ohne <code>@projekt</code> landet hier.</div>
      </header>
      <div className="px-6 py-3 border-b border-[var(--border)]">
        <form onSubmit={submit}>
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="+ Neue Inbox-Task" />
        </form>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {tasks.length === 0 && (
          <EmptyState icon={<Inbox size={32} />} title="Inbox leer." hint="Tippe oben rein und drücke Enter — oder Quick Add ohne @projekt." />
        )}
        {open.length > 0 && (
          <section>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Offen ({open.length})</div>
            <div className="space-y-1.5">{open.map((t) => <TaskRowItem key={t!.id} task={t!} />)}</div>
          </section>
        )}
        {done.length > 0 && (
          <section>
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Erledigt ({done.length})</div>
            <div className="space-y-1.5 opacity-60">{done.map((t) => <TaskRowItem key={t!.id} task={t!} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
