import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

/**
 * Bottom-sheet recurrence picker. Returns RRULE strings (no `RRULE:` prefix,
 * matching `Task.recurrenceRule`) — or `null` for "Aus".
 *
 * Preset shape mirrors the desktop QuickAddSheet recurrence chip (`apps/desktop/
 * src/renderer/components/QuickAddSheet.tsx`): the same preset RRULE strings
 * round-trip cleanly with `rrulestr()` in tasks.complete()'s recurrence spawn.
 *
 * The "Wöchentlich" preset opens a sub-screen with MO–SO checkboxes so the
 * caller can pick a multi-day weekly recurrence. "Custom" exposes freq +
 * interval + byDay multi-select (byDay only visible for WEEKLY).
 */
export interface RRulePickerProps {
  visible: boolean;
  value: string | null;
  onPick: (rrule: string | null) => void;
  onClose: () => void;
}

type Mode = "presets" | "weekly" | "custom";
type Freq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

const WEEKDAYS: readonly { code: string; label: string }[] = [
  { code: "MO", label: "Mo" },
  { code: "TU", label: "Di" },
  { code: "WE", label: "Mi" },
  { code: "TH", label: "Do" },
  { code: "FR", label: "Fr" },
  { code: "SA", label: "Sa" },
  { code: "SU", label: "So" },
];

export function describeRRule(rrule: string | null): string {
  if (!rrule) return "Keine";
  const r = rrule.trim();
  if (r === "FREQ=DAILY") return "Täglich";
  if (r === "FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR") return "Werktags";
  if (r === "FREQ=WEEKLY;INTERVAL=2") return "Alle 2 Wochen";
  if (r === "FREQ=MONTHLY") return "Monatlich";
  if (r === "FREQ=YEARLY") return "Jährlich";
  if (r.startsWith("FREQ=WEEKLY;BYDAY=")) return "Wöchentlich";
  if (r.startsWith("FREQ=WEEKLY")) return "Wöchentlich";
  return "Benutzerdefiniert";
}

export function RRulePicker({ visible, value, onPick, onClose }: RRulePickerProps): JSX.Element {
  const [mode, setMode] = useState<Mode>("presets");
  const [weeklyDays, setWeeklyDays] = useState<string[]>([]);
  const [customFreq, setCustomFreq] = useState<Freq>("WEEKLY");
  const [customInterval, setCustomInterval] = useState("1");
  const [customDays, setCustomDays] = useState<string[]>([]);

  // Reset internal state every time the sheet opens so re-opening starts at
  // the preset list (matching desktop behaviour).
  useEffect(() => {
    if (visible) {
      setMode("presets");
      setWeeklyDays([]);
      setCustomFreq("WEEKLY");
      setCustomInterval("1");
      setCustomDays([]);
    }
  }, [visible]);

  function pick(rrule: string | null): void {
    onPick(rrule);
    onClose();
  }

  function toggle(list: string[], code: string): string[] {
    return list.includes(code) ? list.filter((c) => c !== code) : [...list, code];
  }

  function confirmWeekly(): void {
    if (weeklyDays.length === 0) {
      pick("FREQ=WEEKLY");
      return;
    }
    // Preserve canonical MO,TU,…,SU order.
    const ordered = WEEKDAYS.map((d) => d.code).filter((c) => weeklyDays.includes(c));
    pick(`FREQ=WEEKLY;BYDAY=${ordered.join(",")}`);
  }

  function confirmCustom(): void {
    const intervalNum = Math.max(1, parseInt(customInterval, 10) || 1);
    const parts = [`FREQ=${customFreq}`];
    if (intervalNum > 1) parts.push(`INTERVAL=${intervalNum}`);
    if (customFreq === "WEEKLY" && customDays.length > 0) {
      const ordered = WEEKDAYS.map((d) => d.code).filter((c) => customDays.includes(c));
      parts.push(`BYDAY=${ordered.join(",")}`);
    }
    pick(parts.join(";"));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 justify-end bg-black/40">
        <Pressable onPress={() => {}} className="bg-white rounded-t-2xl pb-6 pt-3 max-h-[80%]">
          <View className="items-center pb-2">
            <View className="w-10 h-1 rounded-full bg-gray-300" />
          </View>
          <Text className="text-base font-semibold text-ink px-4 pb-2">Wiederholung</Text>

          {mode === "presets" ? (
            <PresetList
              currentRule={value}
              onAus={() => pick(null)}
              onTaeglich={() => pick("FREQ=DAILY")}
              onWerktags={() => pick("FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR")}
              onWoechentlich={() => setMode("weekly")}
              onAlleZwei={() => pick("FREQ=WEEKLY;INTERVAL=2")}
              onMonatlich={() => pick("FREQ=MONTHLY")}
              onJaehrlich={() => pick("FREQ=YEARLY")}
              onCustom={() => setMode("custom")}
            />
          ) : null}

          {mode === "weekly" ? (
            <WeekdayPicker
              selected={weeklyDays}
              onToggle={(c) => setWeeklyDays((cur) => toggle(cur, c))}
              onConfirm={confirmWeekly}
              onBack={() => setMode("presets")}
            />
          ) : null}

          {mode === "custom" ? (
            <CustomEditor
              freq={customFreq}
              interval={customInterval}
              days={customDays}
              onFreq={setCustomFreq}
              onInterval={setCustomInterval}
              onToggleDay={(c) => setCustomDays((cur) => toggle(cur, c))}
              onConfirm={confirmCustom}
              onBack={() => setMode("presets")}
            />
          ) : null}

          <Pressable
            onPress={onClose}
            className="mx-4 mt-3 rounded-md border border-gray-300 py-2 items-center"
            hitSlop={8}
          >
            <Text className="text-sm font-medium text-ink">Abbrechen</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PresetList({
  currentRule,
  onAus,
  onTaeglich,
  onWerktags,
  onWoechentlich,
  onAlleZwei,
  onMonatlich,
  onJaehrlich,
  onCustom,
}: {
  currentRule: string | null;
  onAus: () => void;
  onTaeglich: () => void;
  onWerktags: () => void;
  onWoechentlich: () => void;
  onAlleZwei: () => void;
  onMonatlich: () => void;
  onJaehrlich: () => void;
  onCustom: () => void;
}): JSX.Element {
  const active = useMemo(() => describeRRule(currentRule), [currentRule]);
  function Row({ label, onPress, isActive }: { label: string; onPress: () => void; isActive: boolean }): JSX.Element {
    return (
      <Pressable
        onPress={onPress}
        className="px-4 py-3 active:bg-gray-100 rounded-md flex-row items-center justify-between"
      >
        <Text className="text-sm text-ink">{label}</Text>
        {isActive ? <Text className="text-pulse text-sm">✓</Text> : null}
      </Pressable>
    );
  }
  return (
    <ScrollView className="px-2 pb-2">
      <Row label="Aus" onPress={onAus} isActive={currentRule === null} />
      <Row label="Täglich" onPress={onTaeglich} isActive={active === "Täglich"} />
      <Row label="Werktags" onPress={onWerktags} isActive={active === "Werktags"} />
      <Row label="Wöchentlich…" onPress={onWoechentlich} isActive={active === "Wöchentlich"} />
      <Row label="Alle 2 Wochen" onPress={onAlleZwei} isActive={active === "Alle 2 Wochen"} />
      <Row label="Monatlich" onPress={onMonatlich} isActive={active === "Monatlich"} />
      <Row label="Jährlich" onPress={onJaehrlich} isActive={active === "Jährlich"} />
      <Row label="Custom…" onPress={onCustom} isActive={active === "Benutzerdefiniert"} />
    </ScrollView>
  );
}

function WeekdayPicker({
  selected,
  onToggle,
  onConfirm,
  onBack,
}: {
  selected: string[];
  onToggle: (code: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}): JSX.Element {
  return (
    <View className="px-4 pb-2">
      <Text className="text-xs uppercase tracking-wide text-gray-500 pb-2">Tage wählen</Text>
      <View className="flex-row flex-wrap gap-2 pb-3">
        {WEEKDAYS.map((d) => {
          const on = selected.includes(d.code);
          return (
            <Pressable
              key={d.code}
              onPress={() => onToggle(d.code)}
              className={`px-3 py-2 rounded-md border ${
                on ? "bg-pulse border-pulse" : "bg-white border-gray-300"
              }`}
            >
              <Text className={`text-sm ${on ? "text-white" : "text-ink"}`}>{d.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row gap-2">
        <Pressable
          onPress={onBack}
          className="flex-1 rounded-md border border-gray-300 py-2 items-center"
        >
          <Text className="text-sm text-ink">Zurück</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          className="flex-1 rounded-md bg-pulse py-2 items-center"
        >
          <Text className="text-sm font-medium text-white">Übernehmen</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CustomEditor({
  freq,
  interval,
  days,
  onFreq,
  onInterval,
  onToggleDay,
  onConfirm,
  onBack,
}: {
  freq: Freq;
  interval: string;
  days: string[];
  onFreq: (f: Freq) => void;
  onInterval: (s: string) => void;
  onToggleDay: (code: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}): JSX.Element {
  const FREQS: { code: Freq; label: string }[] = [
    { code: "DAILY", label: "Täglich" },
    { code: "WEEKLY", label: "Wöchentlich" },
    { code: "MONTHLY", label: "Monatlich" },
    { code: "YEARLY", label: "Jährlich" },
  ];
  return (
    <ScrollView className="px-4 pb-2" keyboardShouldPersistTaps="handled">
      <Text className="text-xs uppercase tracking-wide text-gray-500 pb-2">Frequenz</Text>
      <View className="flex-row flex-wrap gap-2 pb-3">
        {FREQS.map((f) => {
          const on = freq === f.code;
          return (
            <Pressable
              key={f.code}
              onPress={() => onFreq(f.code)}
              className={`px-3 py-2 rounded-md border ${
                on ? "bg-pulse border-pulse" : "bg-white border-gray-300"
              }`}
            >
              <Text className={`text-sm ${on ? "text-white" : "text-ink"}`}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="text-xs uppercase tracking-wide text-gray-500 pb-2">Intervall</Text>
      <TextInput
        value={interval}
        onChangeText={onInterval}
        keyboardType="number-pad"
        placeholder="1"
        className="text-sm text-ink border border-gray-300 rounded p-2 mb-3"
      />

      {freq === "WEEKLY" ? (
        <>
          <Text className="text-xs uppercase tracking-wide text-gray-500 pb-2">Tage</Text>
          <View className="flex-row flex-wrap gap-2 pb-3">
            {WEEKDAYS.map((d) => {
              const on = days.includes(d.code);
              return (
                <Pressable
                  key={d.code}
                  onPress={() => onToggleDay(d.code)}
                  className={`px-3 py-2 rounded-md border ${
                    on ? "bg-pulse border-pulse" : "bg-white border-gray-300"
                  }`}
                >
                  <Text className={`text-sm ${on ? "text-white" : "text-ink"}`}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <View className="flex-row gap-2 pt-1">
        <Pressable
          onPress={onBack}
          className="flex-1 rounded-md border border-gray-300 py-2 items-center"
        >
          <Text className="text-sm text-ink">Zurück</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          className="flex-1 rounded-md bg-pulse py-2 items-center"
        >
          <Text className="text-sm font-medium text-white">Übernehmen</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
