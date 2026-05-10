import { useEffect } from "react";
import { Sidebar } from "./Sidebar.js";
import { useUi } from "../stores/ui.js";
import { useTasks } from "../stores/tasks.js";
import { useProjects } from "../stores/projects.js";
import { useTags } from "../stores/tags.js";
import { TodayView } from "../today/TodayView.js";
import { UpcomingView } from "../today/UpcomingView.js";
import { ProjectView } from "../project/ProjectView.js";

export function AppShell(): JSX.Element {
  const view = useUi((s) => s.currentView);
  const detailOpen = useUi((s) => s.detailOpen);

  useEffect(() => {
    void useProjects.getState().refresh();
    void useTags.getState().refresh();
    void useTasks.getState().refreshToday();
    void useTasks.getState().refreshUpcoming();
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 flex min-w-0">
          <div className="flex-1 min-w-0 bg-white border-r border-[var(--border)]">
            <ViewSlot view={view} />
          </div>
          {detailOpen && <DetailSlot />}
        </main>
      </div>
      {/* StatusBar + TopBarPill come in later tasks */}
    </div>
  );
}

function ViewSlot({ view }: { view: ReturnType<typeof useUi.getState>["currentView"] }) {
  switch (view.kind) {
    case "today":    return <TodayView />;
    case "upcoming": return <UpcomingView />;
    case "project":  return <ProjectView projectId={view.projectId} />;
    case "tag":      return <div className="p-6 text-gray-500">Tag {view.tagId}</div>;
  }
}

function DetailSlot() {
  return <div className="w-[380px] border-l border-[var(--border)] p-4">Detail (Task 17)</div>;
}
