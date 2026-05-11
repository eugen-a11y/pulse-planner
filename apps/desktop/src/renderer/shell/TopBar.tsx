import { Search } from "lucide-react";

// Header strip with a centered "Suchen…" trigger. Click → opens SearchPalette
// via a Ctrl+K-style keydown event the palette already listens to.
export function TopBar(): JSX.Element {
  function openSearch() {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
  }
  return (
    <div className="h-10 border-b border-[var(--border)] flex items-center px-3 bg-white">
      <div className="flex-1" />
      <button onClick={openSearch}
        className="flex items-center gap-2 w-[440px] max-w-[60vw] px-3 py-1.5 rounded-md border border-[var(--border)] text-sm text-gray-400 hover:border-pulse/60 hover:text-gray-600 bg-[var(--gray-bg)]">
        <Search size={14} />
        <span className="flex-1 text-left">Suchen — Tasks, Projekte…</span>
        <kbd className="text-xs text-gray-400 border border-[var(--border)] rounded px-1 py-0.5 bg-white">Ctrl+K</kbd>
      </button>
      <div className="flex-1" />
    </div>
  );
}
