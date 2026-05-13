import { useState } from "react";
import { LogOut, UserX } from "lucide-react";
import { SystemViews } from "./SystemViews.js";
import { ProjectList } from "./ProjectList.js";
import { TagList } from "./TagList.js";
import { api } from "../api.js";
import { useAuth } from "../stores/auth.js";
import { useToasts } from "../components/ui/toast.js";
import { Dialog, DialogTitle, DialogDescription } from "../components/ui/dialog.js";
import { Button } from "../components/ui/button.js";

export function Sidebar(): JSX.Element {
  const session = useAuth((s) => s.session);
  const signOut = useAuth((s) => s.signOut);
  const deleteAccount = useAuth((s) => s.deleteAccount);
  const push = useToasts((s) => s.push);
  const [confirmDelete, setConfirmDelete] = useState<0 | 1 | 2>(0);
  const [deleting, setDeleting] = useState(false);

  async function onDeleteAccount(): Promise<void> {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteAccount();
      setConfirmDelete(0);
      push("Konto gelöscht.", "info");
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setDeleting(false);
    }
  }

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
        <button onClick={() => setConfirmDelete(1)}
          className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-white"
          title="Konto löschen">
          <UserX size={14} />
        </button>
        <button onClick={() => void signOut()}
          className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-white"
          title="Abmelden">
          <LogOut size={14} />
        </button>
      </div>

      <Dialog open={confirmDelete > 0} onOpenChange={(open) => { if (!open) setConfirmDelete(0); }}>
        {confirmDelete === 1 && (
          <>
            <DialogTitle className="text-lg font-semibold mb-2">Konto löschen?</DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mb-4">
              Alle deine Projekte, Aufgaben, Tags und Kommentare werden unwiederbringlich
              aus der Cloud gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(0)}>Abbrechen</Button>
              <Button variant="danger" onClick={() => setConfirmDelete(2)}>Weiter</Button>
            </div>
          </>
        )}
        {confirmDelete === 2 && (
          <>
            <DialogTitle className="text-lg font-semibold mb-2">Wirklich endgültig löschen?</DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mb-4">
              Letzte Bestätigung. Danach ist dein Konto weg.
            </DialogDescription>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(0)} disabled={deleting}>Abbrechen</Button>
              <Button variant="danger" onClick={() => void onDeleteAccount()} disabled={deleting}>
                {deleting ? "Lösche…" : "Endgültig löschen"}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </aside>
  );
}

function SidebarDivider() {
  return <div className="border-t border-[var(--border)] my-2 mx-3" />;
}
