import { Text } from "react-native";

/**
 * Tiny priority indicator. Mirrors apps/desktop/src/renderer/components/
 * PriorityBadge.tsx but uses RN <Text> + NativeWind class strings. The label
 * strings are intentionally identical to the desktop set so screenshots line
 * up across platforms.
 */
const LABEL: Record<number, string> = { 1: "▲▲▲", 2: "▲▲", 3: "▲", 4: "·" };
const COLOR: Record<number, string> = {
  1: "text-red-600",
  2: "text-orange-500",
  3: "text-yellow-600",
  4: "text-gray-400",
};

export function PriorityBadge({ priority }: { priority: 1 | 2 | 3 | 4 }): JSX.Element {
  return <Text className={`text-xs ${COLOR[priority]}`}>{LABEL[priority]}</Text>;
}
