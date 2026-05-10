import { useEffect, useState } from "react";
import { useSync } from "../stores/sync.js";

export function OfflineBanner(): JSX.Element | null {
  const status = useSync((s) => s.status);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    return () => {
      window.removeEventListener("online", onOn);
      window.removeEventListener("offline", onOff);
    };
  }, []);
  if (online && status.outboxSize === 0) return null;
  return (
    <div className="h-7 px-3 flex items-center text-xs bg-amber-50 text-amber-900 border-b border-amber-200">
      {online
        ? <>Sync hängt · {status.outboxSize} Änderungen warten</>
        : <>Offline · {status.outboxSize > 0 ? `${status.outboxSize} Änderungen werden nachgesendet` : "Pulse arbeitet weiter"}</>}
    </div>
  );
}
