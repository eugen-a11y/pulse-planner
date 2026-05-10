import { SystemViews } from "./SystemViews.js";
import { ProjectList } from "./ProjectList.js";
import { TagList } from "./TagList.js";
import { api } from "../api.js";

export function Sidebar(): JSX.Element {
  return (
    <aside className="w-[220px] bg-[var(--gray-bg)] border-r border-[var(--border)] flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
        <div className="text-pulse font-semibold tracking-wide">PULSE</div>
        <button onClick={() => api.quickAdd.show()}
          className="text-xs text-gray-500 hover:text-pulse" title="Quick Add (Ctrl+Shift+Space)">⌘+</button>
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
