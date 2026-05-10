import { useState, useRef, useEffect } from "react";

export const PROJECT_COLORS: readonly string[] = [
  "#2563EB", // pulse blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
  "#6B7280", // slate
];

export function ColorSwatch({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) { if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative inline-block" ref={popRef}>
      <button onClick={() => setOpen((o) => !o)}
        className="w-5 h-5 rounded-full border border-black/10 hover:ring-2 hover:ring-pulse/30 transition"
        style={{ background: value }}
        aria-label="Projektfarbe ändern" />
      {open && (
        <div className="absolute z-20 top-7 left-0 bg-white border border-[var(--border)] rounded-lg shadow-lg p-3 flex gap-2.5 whitespace-nowrap">
          {PROJECT_COLORS.map((c) => (
            <button key={c}
              onClick={() => { onChange(c); setOpen(false); }}
              className={`w-7 h-7 rounded-full flex-shrink-0 border-2 transition ${c.toLowerCase() === value.toLowerCase() ? "border-pulse ring-2 ring-pulse ring-offset-1" : "border-black/10 hover:border-pulse/60"}`}
              style={{ background: c }}
              aria-label={c} />
          ))}
        </div>
      )}
    </div>
  );
}
