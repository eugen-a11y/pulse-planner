import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

/**
 * Bottom-sheet picker for a task's reminder offset. Presets:
 *   Aus / Zum Ereignis / 5 / 10 / 15 / 30 / 60 min vorher / Eigene…
 *
 * "Eigene" swaps the preset list for a number input + Minuten/Stunden toggle,
 * commits on "Speichern". Max 7 days back (10080 minutes), matching the
 * tasks_reminder_offset_check constraint on the Postgres side.
 */
export interface ReminderPickerProps {
  visible: boolean;
  /** Current value: null = aus, 0 = zum Ereignis, N = N minutes before. */
  value: number | null;
  onPick: (offsetMinutes: number | null) => void;
  onClose: () => void;
}

const MAX_MINUTES = 10080;

const PRESETS: Array<{ label: string; value: number | null }> = [
  { label: "Aus",              value: null },
  { label: "Zum Ereignis",     value: 0 },
  { label: "5 min vorher",     value: 5 },
  { label: "10 min vorher",    value: 10 },
  { label: "15 min vorher",    value: 15 },
  { label: "30 min vorher",    value: 30 },
  { label: "1 Stunde vorher",  value: 60 },
];

export function describeReminder(offsetMinutes: number | null): string {
  if (offsetMinutes === null) return "Aus";
  if (offsetMinutes === 0) return "Zum Ereignis";
  if (offsetMinutes < 60) return `${offsetMinutes} min vorher`;
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
  const [customOpen, setCustomOpen] = useState(false);
  const [customNum, setCustomNum] = useState("");
  const [customUnit, setCustomUnit] = useState<"min" | "h">("min");

  // Reset internal state every time the sheet re-opens so a fresh open never
  // shows stale custom-input remnants.
  useEffect(() => {
    if (visible) {
      setCustomOpen(false);
      setCustomNum("");
      setCustomUnit("min");
    }
  }, [visible]);

  const isPreset = PRESETS.some((p) => p.value === value);

  function commitPreset(v: number | null): void {
    onPick(v);
    onClose();
  }

  function commitCustom(): void {
    const n = Number(customNum.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    const minutes = customUnit === "h" ? Math.round(n * 60) : Math.round(n);
    if (minutes < 0 || minutes > MAX_MINUTES) return;
    onPick(minutes);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Pressable
          onPress={() => {
            setCustomOpen(false);
            onClose();
          }}
          style={{ flex: 1 }}
        />
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
              style={{
                width: 40,
                height: 4,
                borderRadius: 999,
                backgroundColor: "#D1D5DB",
              }}
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

          {customOpen ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              <Text style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>
                Eigene Vorlaufzeit
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TextInput
                  value={customNum}
                  onChangeText={setCustomNum}
                  keyboardType="number-pad"
                  placeholder="z. B. 45"
                  placeholderTextColor="#94A3B8"
                  autoFocus
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: "#CBD5E1",
                    borderRadius: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 16,
                    color: "#0F172A",
                  }}
                />
                <Pressable
                  onPress={() => setCustomUnit("min")}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: customUnit === "min" ? "#2563EB" : "#CBD5E1",
                    backgroundColor: customUnit === "min" ? "#EFF6FF" : "#FFFFFF",
                  }}
                >
                  <Text style={{ color: customUnit === "min" ? "#2563EB" : "#0F172A", fontSize: 14 }}>
                    Minuten
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setCustomUnit("h")}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: customUnit === "h" ? "#2563EB" : "#CBD5E1",
                    backgroundColor: customUnit === "h" ? "#EFF6FF" : "#FFFFFF",
                  }}
                >
                  <Text style={{ color: customUnit === "h" ? "#2563EB" : "#0F172A", fontSize: 14 }}>
                    Stunden
                  </Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <Pressable
                  onPress={() => setCustomOpen(false)}
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
                    Zurück
                  </Text>
                </Pressable>
                <Pressable
                  onPress={commitCustom}
                  disabled={!customNum.trim()}
                  style={{
                    flex: 1,
                    backgroundColor: customNum.trim() ? "#2563EB" : "#CBD5E1",
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
          ) : (
            <View style={{ paddingHorizontal: 8, paddingBottom: 4 }}>
              {PRESETS.map((p) => {
                const on = p.value === value;
                return (
                  <Pressable
                    key={String(p.value)}
                    onPress={() => commitPreset(p.value)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: 6,
                      backgroundColor: pressed ? "#F3F4F6" : "transparent",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    })}
                  >
                    <Text style={{ fontSize: 15, color: "#0F172A" }}>{p.label}</Text>
                    {on ? (
                      <Text style={{ color: "#2563EB", fontSize: 15 }}>✓</Text>
                    ) : null}
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setCustomOpen(true)}
                style={({ pressed }) => ({
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 6,
                  backgroundColor: pressed ? "#F3F4F6" : "transparent",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                })}
              >
                <Text style={{ fontSize: 15, color: "#0F172A" }}>Eigene…</Text>
                {value !== null && !isPreset ? (
                  <Text style={{ color: "#2563EB", fontSize: 15 }}>
                    ✓ {describeReminder(value)}
                  </Text>
                ) : null}
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={() => {
              setCustomOpen(false);
              onClose();
            }}
            style={{
              marginHorizontal: 16,
              marginTop: 8,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: "#CBD5E1",
              paddingVertical: 10,
              alignItems: "center",
            }}
            hitSlop={8}
          >
            <Text style={{ fontSize: 14, fontWeight: "500", color: "#0F172A" }}>
              Abbrechen
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
