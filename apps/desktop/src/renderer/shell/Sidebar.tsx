import { SystemViews } from "./SystemViews.js";
import { ProjectList } from "./ProjectList.js";
import { TagList } from "./TagList.js";

export function Sidebar(): JSX.Element {
  return (
    <aside className="w-[220px] bg-[var(--gray-bg)] border-r border-[var(--border)] flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border)]">
        <div className="text-pulse font-semibold tracking-wide">PULSE</div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <SystemViews />
        <SidebarDivider />
        <ProjectList />
        <SidebarDivider />
        <TagList />
      </div>
    </aside>
  );
}

function SidebarDivider() {
  return <div className="border-t border-[var(--border)] my-2 mx-3" />;
}
