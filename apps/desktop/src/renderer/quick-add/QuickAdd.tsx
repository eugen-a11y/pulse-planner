import { useEffect, useState } from "react";
import { api } from "../api.js";

export function QuickAdd(): JSX.Element {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") window.close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const parsed = await api.quickAdd.parse(text);
      await api.quickAdd.submit(parsed);
      window.close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="h-screen w-screen p-3 bg-white border border-[var(--border)] rounded-md shadow-md">
      <input autoFocus value={text} onChange={(e) => setText(e.target.value)} disabled={busy}
        placeholder="Quick add — Title  @projekt  !1-4  morgen 9:00  #tag"
        className="w-full h-10 px-3 text-sm border border-[var(--border)] rounded focus:outline-none focus:ring-2 focus:ring-pulse/40 focus:border-pulse" />
      <div className="text-xs text-gray-400 mt-2">Enter sendet · Esc schließt</div>
    </form>
  );
}
