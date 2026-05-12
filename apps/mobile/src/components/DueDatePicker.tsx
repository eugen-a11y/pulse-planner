import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DateTimePicker: any = (() => {
  try {
    // Optional native dep — declared in package.json. The require is wrapped so
    // that test environments (which don't ship the native module) can still
    // import this file without exploding.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-community/datetimepicker").default;
  } catch {
    return null;
  }
})();

/**
 * Bottom-sheet style modal to set / clear a project's due date.
 * Quick actions: "Heute", "Morgen", "Datum wählen…", "Entfernen".
 *
 * The "Datum wählen…" branch swaps the action list for the native
 * DateTimePicker (iOS spinner / Android dialog) and confirms on user pick.
 *
 * Returns ISO strings via onPick (or null when cleared).
 */
export interface DueDatePickerProps {
  visible: boolean;
  value: string | null;
  onPick: (iso: string | null) => void;
  onClose: () => void;
}

function atEndOfDay(d: Date): Date {
  const next = new Date(d);
  next.setHours(23, 59, 0, 0);
  return next;
}

export function DueDatePicker({
  visible,
  value,
  onPick,
  onClose,
}: DueDatePickerProps): JSX.Element {
  const [pickingDate, setPickingDate] = useState(false);

  function pickHeute(): void {
    onPick(atEndOfDay(new Date()).toISOString());
    onClose();
  }
  function pickMorgen(): void {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    onPick(atEndOfDay(d).toISOString());
    onClose();
  }
  function pickEntfernen(): void {
    onPick(null);
    onClose();
  }
  function onNativeChange(_event: unknown, selected?: Date): void {
    // Android closes on its own; iOS keeps the picker visible.
    if (Platform.OS !== "ios") setPickingDate(false);
    if (selected) {
      onPick(selected.toISOString());
      onClose();
      setPickingDate(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={() => {
          setPickingDate(false);
          onClose();
        }}
        className="flex-1 justify-end"
      >
        <Pressable
          onPress={() => {}}
          className="bg-white rounded-t-2xl pb-6 pt-3 border border-gray-300"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.18,
            shadowRadius: 14,
            elevation: 12,
          }}
        >
          <View className="items-center pb-2">
            <View className="w-10 h-1 rounded-full bg-gray-300" />
          </View>
          <Text className="text-base font-semibold text-ink px-4 pb-2">
            Fälligkeit
          </Text>
          {pickingDate && DateTimePicker ? (
            <View className="px-4 pb-2">
              <DateTimePicker
                value={value ? new Date(value) : new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onNativeChange}
              />
            </View>
          ) : (
            <View className="px-2 pb-2">
              <Pressable
                onPress={pickHeute}
                className="px-4 py-3 active:bg-gray-100 rounded-md"
              >
                <Text className="text-sm text-ink">Heute</Text>
              </Pressable>
              <Pressable
                onPress={pickMorgen}
                className="px-4 py-3 active:bg-gray-100 rounded-md"
              >
                <Text className="text-sm text-ink">Morgen</Text>
              </Pressable>
              <Pressable
                onPress={() => setPickingDate(true)}
                className="px-4 py-3 active:bg-gray-100 rounded-md"
              >
                <Text className="text-sm text-ink">Datum wählen…</Text>
              </Pressable>
              {value !== null && (
                <Pressable
                  onPress={pickEntfernen}
                  className="px-4 py-3 active:bg-gray-100 rounded-md"
                >
                  <Text className="text-sm text-red-600">Entfernen</Text>
                </Pressable>
              )}
            </View>
          )}
          <Pressable
            onPress={() => {
              setPickingDate(false);
              onClose();
            }}
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
