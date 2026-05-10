import { LogOut } from "lucide-react";
import { SystemViews } from "./SystemViews.js";
import { ProjectList } from "./ProjectList.js";
import { TagList } from "./TagList.js";
import { api } from "../api.js";
import { useAuth } from "../stores/auth.js";

export function Sidebar(): JSX.Element {
  const session = useAuth((s) => s.session);
  const signOut = useAuth((s) => s.signOut);

  return (
    <aside className="w-[220px] bg-[var(--gray-bg)] border-r border-[var(--border)] flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
        <div className="text-pulse font-semibold tracking-tight text-xs whitespace-nowrap">Pulse Project Planner</div>
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
      <div className="border-t border-[var(--border)] p-3 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 truncate" title={session?.user.email ?? ""}>
            {session?.user.email ?? "—"}
          </div>
        </div>
        <button onClick={() => void signOut()}
          className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-white"
          title="Abmelden">
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}

function SidebarDivider() {
  return <div className="border-t border-[var(--border)] my-2 mx-3" />;
}
