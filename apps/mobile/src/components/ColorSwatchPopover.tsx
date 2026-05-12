import { Modal, Pressable, Text, View } from "react-native";

/**
 * Bottom-sheet popover with 8 preset project colors. Mirrors the desktop
 * `apps/desktop/src/renderer/components/ColorSwatch.tsx` palette spirit but
 * uses the smaller hex set requested by the Task 13 spec.
 *
 * Implementation:
 *   • Single-row of circles, tap a circle → onPick(hex) + onClose().
 *   • Backdrop tap closes.
 */
export const PROJECT_COLORS: readonly string[] = [
  "#2563EB",
  "#DC2626",
  "#16A34A",
  "#CA8A04",
  "#9333EA",
  "#0891B2",
  "#DB2777",
  "#475569",
];

export interface ColorSwatchPopoverProps {
  visible: boolean;
  value: string;
  onPick: (hex: string) => void;
  onClose: () => void;
}

export function ColorSwatchPopover({
  visible,
  value,
  onPick,
  onClose,
}: ColorSwatchPopoverProps): JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 justify-end">
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
          <Text className="text-base font-semibold text-ink px-4 pb-3">
            Projektfarbe
          </Text>
          <View className="flex-row flex-wrap gap-3 px-4 pb-2">
            {PROJECT_COLORS.map((c) => {
              const selected = c.toLowerCase() === value.toLowerCase();
              return (
                <Pressable
                  key={c}
                  hitSlop={6}
                  onPress={() => {
                    onPick(c);
                    onClose();
                  }}
                  className={`w-10 h-10 rounded-full ${
                    selected ? "border-2 border-pulse" : "border border-black/10"
                  }`}
                  style={{ backgroundColor: c }}
                  accessibilityLabel={c}
                />
              );
            })}
          </View>
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
