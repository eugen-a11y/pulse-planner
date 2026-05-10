import { useSync } from "../stores/sync.js";
import { timeAgo } from "../lib/format.js";
import { CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { api } from "../api.js";

export function StatusBar(): JSX.Element {
  const status = useSync((s) => s.status);
  const ok = status.lastError === null;
  const lastSync = status.lastPullAt ?? status.lastPushAt;
  return (
    <div className="h-7 px-3 flex items-center justify-between text-xs text-gray-500 border-t border-[var(--border)] bg-white">
      <div className="flex items-center gap-2">
        {ok
          ? <CheckCircle2 size={12} className="text-green-600" />
          : <AlertCircle size={12} className="text-red-600" />}
        <span>{ok ? "Sync OK" : `Sync-Fehler: ${status.lastError}`}</span>
        {lastSync && <span>· {timeAgo(lastSync)}</span>}
        {status.outboxSize > 0 && <span>· {status.outboxSize} ausstehend</span>}
      </div>
      <button onClick={() => void api.sync.pullNow()} className="hover:text-pulse flex items-center gap-1">
        <RotateCcw size={12} /> Sync
      </button>
    </div>
  );
}
