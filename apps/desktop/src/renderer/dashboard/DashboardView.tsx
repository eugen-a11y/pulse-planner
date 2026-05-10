import { useEffect, useMemo } from "react";
import { LayoutDashboard, Plus } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useTasks } from "../stores/tasks.js";
import { useProjects } from "../stores/projects.js";
import { useUi } from "../stores/ui.js";
import { api } from "../api.js";
import { DueDateBadge } from "../components/DueDateBadge.js";
import { EmptyState } from "../components/EmptyState.js";
import type { Task } from "@pulse/core";

export function DashboardView(): JSX.Element {
  // Select primitive refs from the stores. Mapping/Object.values inside the selector
  // returns a new array each call → useSyncExternalStore loops → React #185.
  const projectOrder = useProjects((s) => s.order);
  const projectsById = useProjects((s) => s.byId);
  const tasksById = useTasks((s) => s.byId);
  const setView = useUi((s) => s.setView);

  // Pull all tasks across all projects on mount so KPIs reflect the full universe,
  // not just whatever Today/Upcoming have already cached.
  useEffect(() => { void loadAllTasks(); }, []);

  const projects = useMemo(() => projectOrder.map((id) => projectsById[id]!).filter(Boolean), [projectOrder, projectsById]);
  const allTasks = useMemo(() => Object.values(tasksById), [tasksById]);
  const stats = useMemo(() => computeStats(allTasks), [allTasks]);
  const perProject = useMemo(() => computePerProject(projects, allTasks), [projects, allTasks]);

  return (
    <div className="h-full flex flex-col">
      <header className="px-8 py-5 border-b border-[var(--border)]">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <LayoutDashboard className="text-pulse" size={22} /> Dashboard
        </h1>
        <div className="text-xs text-gray-500 mt-1">
          {format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })} · KW {format(new Date(), "I", { locale: de })}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-8 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <Kpi label="Offen gesamt"      value={stats.open}     hint="über alle Projekte" />
          <Kpi label="Heute fällig"      value={stats.today}    hint="noch zu erledigen" tone="pulse" />
          <Kpi label="Überfällig"        value={stats.overdue}  hint="aufholen"           tone="red" />
          <Kpi label="Erledigt · Woche"  value={stats.doneWeek} hint="diese ISO-Woche"    tone="emerald" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Projekte</div>
          </div>

          {projects.length === 0 ? (
            <EmptyState icon={<Plus size={32} />} title="Noch keine Projekte." hint="Lege links in der Sidebar dein erstes Projekt an." />
          ) : (
            <div className="border border-[var(--border)] rounded-lg divide-y divide-[var(--border)] bg-white">
              {perProject.map(({ project, total, done, percent, nextDue }) => (
                <button key={project.id}
                  onClick={() => setView({ kind: "project", projectId: project.id })}
                  className="w-full px-4 py-3 flex items-center gap-4 hover:bg-gray-50 text-left">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: project.color }} />
                  <div className="w-40 truncate font-medium text-sm">{project.name}</div>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${percent}%`, background: barColor(percent) }} />
                  </div>
                  <div className="w-16 text-xs text-gray-500 text-right tabular-nums">{done} / {total}</div>
                  <div className="w-12 text-sm font-medium text-right tabular-nums">{percent}%</div>
                  <div className="w-36 text-right">
                    {nextDue ? <DueDateBadge iso={nextDue} /> : <span className="text-xs text-gray-300">–</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

async function loadAllTasks(): Promise<void> {
  // We need every task (not just today/upcoming) for the dashboard counts.
  // Lean on tasks.list with no project filter — it returns the user's full set.
  const list = await api.tasks.list({});
  const idx: Record<string, Task> = {};
  const byProject: Record<string, string[]> = {};
  for (const t of list) {
    idx[t.id] = t;
    if (!byProject[t.projectId]) byProject[t.projectId] = [];
    byProject[t.projectId]!.push(t.id);
  }
  useTasks.setState((s) => ({
    byId: { ...s.byId, ...idx },
    byProject: { ...s.byProject, ...byProject },
    loaded: true,
  }));
}

function computeStats(tasks: Task[]): { open: number; today: number; overdue: number; doneWeek: number } {
  const live = tasks.filter((t) => !t.deletedAt);
  const open = live.filter((t) => t.status !== "done");
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();   endOfDay.setHours(23, 59, 59, 999);
  const startOfWeek = new Date();
  const day = startOfWeek.getDay() || 7;          // 1=Mon..7=Sun
  startOfWeek.setDate(startOfWeek.getDate() - (day - 1));
  startOfWeek.setHours(0, 0, 0, 0);

  return {
    open: open.length,
    today: open.filter((t) => t.dueDate && t.dueDate >= startOfDay.toISOString() && t.dueDate <= endOfDay.toISOString()).length,
    overdue: open.filter((t) => t.dueDate && t.dueDate < startOfDay.toISOString()).length,
    doneWeek: live.filter((t) => t.status === "done" && (t.completedAt ?? t.updatedAt) >= startOfWeek.toISOString()).length,
  };
}

function computePerProject(projects: Array<{ id: string; name: string; color: string }>, tasks: Task[]) {
  return projects.map((p) => {
    const ofProject = tasks.filter((t) => t.projectId === p.id && !t.deletedAt);
    const done = ofProject.filter((t) => t.status === "done").length;
    const total = ofProject.length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    const open = ofProject.filter((t) => t.status !== "done" && t.dueDate);
    open.sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
    const nextDue = open[0]?.dueDate ?? null;
    return { project: p, done, total, percent, nextDue };
  });
}

function barColor(pct: number): string {
  if (pct >= 85) return "#10B981"; // emerald
  if (pct >= 40) return "#2563EB"; // pulse blue
  if (pct >= 1)  return "#F59E0B"; // amber
  return "#9CA3AF";                // gray for 0%
}

function Kpi({ label, value, hint, tone }: { label: string; value: number; hint: string; tone?: "pulse" | "red" | "emerald" }) {
  const labelCls = tone === "red" ? "text-red-600"
    : tone === "emerald" ? "text-emerald-600"
    : tone === "pulse" ? "text-pulse"
    : "text-gray-400";
  const valueCls = tone === "red" ? "text-red-600"
    : tone === "emerald" ? "text-emerald-600"
    : tone === "pulse" ? "text-pulse"
    : "text-gray-900";
  return (
    <div className="border border-[var(--border)] rounded-lg p-4 bg-white">
      <div className={`text-xs uppercase tracking-wide ${labelCls}`}>{label}</div>
      <div className={`text-3xl font-semibold mt-1 ${valueCls} tabular-nums`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{hint}</div>
    </div>
  );
}
