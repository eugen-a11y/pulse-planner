import { useEffect, useState } from "react";
import { RRule } from "rrule";

const PRESETS: Array<{ key: string; label: string; rule: string | null }> = [
  { key: "off",        label: "Aus",                   rule: null },
  { key: "daily",      label: "Täglich",               rule: "FREQ=DAILY" },
  { key: "weekdays",   label: "Werktags",              rule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
  { key: "weekly",     label: "Wöchentlich",           rule: "FREQ=WEEKLY" },
  { key: "biweekly",   label: "Alle 2 Wochen",         rule: "FREQ=WEEKLY;INTERVAL=2" },
  { key: "monthly",    label: "Monatlich",             rule: "FREQ=MONTHLY" },
  { key: "yearly",     label: "Jährlich",              rule: "FREQ=YEARLY" },
  { key: "custom",     label: "Custom RRULE…",         rule: "" },
];

export function RecurrenceField({ value, onChange }: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const matched = PRESETS.find((p) => p.rule === value);
  const initialKey = matched ? matched.key : value ? "custom" : "off";
  const [key, setKey] = useState(initialKey);
  const [custom, setCustom] = useState(matched ? "" : value ?? "");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const m = PRESETS.find((p) => p.rule === value);
    setKey(m ? m.key : value ? "custom" : "off");
    setCustom(m ? "" : value ?? "");
  }, [value]);

  function pick(nextKey: string) {
    setKey(nextKey);
    setErr(null);
    const preset = PRESETS.find((p) => p.key === nextKey)!;
    if (preset.key === "custom") return;       // wait for textarea blur
    onChange(preset.rule);
  }

  function commitCustom() {
    if (!custom.trim()) { onChange(null); return; }
    try {
      RRule.fromString(`RRULE:${custom.trim()}`);
      setErr(null);
      onChange(custom.trim());
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select value={key} onChange={(e) => pick(e.target.value)}
        className="text-xs bg-transparent border border-[var(--border)] rounded px-2 py-1">
        {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      {key === "custom" && (
        <input value={custom} onChange={(e) => setCustom(e.target.value)} onBlur={commitCustom}
          placeholder="z.B. FREQ=WEEKLY;BYDAY=MO,WE"
          className="text-xs bg-transparent border border-[var(--border)] rounded px-2 py-1 w-64 font-mono" />
      )}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
