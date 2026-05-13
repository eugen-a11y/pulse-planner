import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PickerCmp: any = (() => {
  try {
    // Optional native dep — declared in package.json. The require is wrapped so
    // tests (which don't ship the native module) can import this file.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-picker/picker").Picker;
  } catch {
    return null;
  }
})();

/**
 * Bottom-sheet reminder offset picker rendered as an iOS-style spinner wheel
 * (UIPickerView via @react-native-picker/picker). 14 fixed presets, the user
 * scrolls the wheel and taps "Speichern" to commit. No custom-input branch —
 * the preset coverage is wide enough for daily use.
 *
 * Internally stores the choice as a sentinel string ("null" for Aus); we
 * round-trip to number|null at the boundary.
 */
export interface ReminderPickerProps {
  visible: boolean;
  /** Current value: null = aus, 0 = zum Ereignis, N = N minutes before. */
  value: number | null;
  onPick: (offsetMinutes: number | null) => void;
  onClose: () => void;
}

const PRESETS: Array<{ key: string; label: string; value: number | null }> = [
  { key: "off",   label: "Aus",                value: null },
  { key: "0",     label: "Zum Ereignis",       value: 0 },
  { key: "5",     label: "5 min vorher",       value: 5 },
  { key: "10",    label: "10 min vorher",      value: 10 },
  { key: "15",    label: "15 min vorher",      value: 15 },
  { key: "30",    label: "30 min vorher",      value: 30 },
  { key: "60",    label: "1 Stunde vorher",    value: 60 },
  { key: "120",   label: "2 Stunden vorher",   value: 120 },
  { key: "180",   label: "3 Stunden vorher",   value: 180 },
  { key: "360",   label: "6 Stunden vorher",   value: 360 },
  { key: "720",   label: "12 Stunden vorher",  value: 720 },
  { key: "1440",  label: "1 Tag vorher",       value: 1440 },
  { key: "2880",  label: "2 Tage vorher",      value: 2880 },
  { key: "10080", label: "1 Woche vorher",     value: 10080 },
];

function keyForValue(v: number | null): string {
  if (v === null) return "off";
  const exact = PRESETS.find((p) => p.value === v);
  if (exact) return exact.key;
  // Closest preset; falls back to "0" when only "off" + "0" exist.
  let best = PRESETS[1]!;
  let bestDelta = Math.abs((best.value as number) - v);
  for (const p of PRESETS) {
    if (p.value === null) continue;
    const d = Math.abs((p.value as number) - v);
    if (d < bestDelta) { best = p; bestDelta = d; }
  }
  return best.key;
}

function valueForKey(k: string): number | null {
  const found = PRESETS.find((p) => p.key === k);
  return found ? found.value : null;
}

export function describeReminder(offsetMinutes: number | null): string {
  const exact = PRESETS.find((p) => p.value === offsetMinutes);
  if (exact) return exact.label;
  // Off-preset values (legacy custom inputs from earlier builds) are summarised.
  if (offsetMinutes === null) return "Aus";
  if (offsetMinutes === 0) return "Zum Ereignis";
  if (offsetMinutes < 60) return `${offsetMinutes} min vorher`;
  if (offsetMinutes % 1440 === 0) {
    const d = offsetMinutes / 1440;
    return d === 1 ? "1 Tag vorher" : `${d} Tage vorher`;
  }
  if (offsetMinutes % 60 === 0) {
    const h = offsetMinutes / 60;
    return h === 1 ? "1 Stunde vorher" : `${h} Stunden vorher`;
  }
  return `${offsetMinutes} min vorher`;
}

export function ReminderPicker({
  visible,
  value,
  onPick,
  onClose,
}: ReminderPickerProps): JSX.Element {
  const [draftKey, setDraftKey] = useState<string>(() => keyForValue(value));

  // Re-seed every time the sheet opens so a fresh open shows the current value.
  useEffect(() => {
    if (visible) setDraftKey(keyForValue(value));
  }, [visible, value]);

  function commit(): void {
    onPick(valueForKey(draftKey));
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, justifyContent: "flex-end" }} />
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingBottom: 24,
          paddingTop: 12,
          borderWidth: 1,
          borderColor: "#D1D5DB",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.18,
          shadowRadius: 14,
          elevation: 12,
        }}
      >
        <View style={{ alignItems: "center", paddingBottom: 8 }}>
          <View
            style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: "#D1D5DB" }}
          />
        </View>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: "#0F172A",
            paddingHorizontal: 16,
            paddingBottom: 8,
          }}
        >
          Erinnerung
        </Text>

        {PickerCmp ? (
          <View style={{ paddingHorizontal: 16 }}>
            <PickerCmp
              selectedValue={draftKey}
              onValueChange={(v: string) => setDraftKey(v)}
              itemStyle={
                Platform.OS === "ios"
                  ? { fontSize: 18, color: "#0F172A" }
                  : undefined
              }
              style={Platform.OS === "ios" ? { height: 216 } : { color: "#0F172A" }}
            >
              {PRESETS.map((p) => (
                <PickerCmp.Item key={p.key} label={p.label} value={p.key} />
              ))}
            </PickerCmp>
          </View>
        ) : (
          // Test-environment fallback — pure JS list.
          <View style={{ paddingHorizontal: 16 }}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.key}
                onPress={() => setDraftKey(p.key)}
                style={{ paddingVertical: 8 }}
              >
                <Text style={{ color: "#0F172A", fontSize: 15 }}>
                  {draftKey === p.key ? "● " : "○ "}{p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 12 }}>
          <Pressable
            onPress={onClose}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#CBD5E1",
              borderRadius: 6,
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#0F172A", fontSize: 14, fontWeight: "500" }}>
              Abbrechen
            </Text>
          </Pressable>
          <Pressable
            onPress={commit}
            style={{
              flex: 1,
              backgroundColor: "#2563EB",
              borderRadius: 6,
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "500" }}>
              Speichern
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
