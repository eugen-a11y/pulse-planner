import { Pressable, Text, View } from "react-native";
import type { Tag } from "@pulse/core";

/**
 * Single tag row used by TagsScreen (Task 15). Renders:
 *   • Color dot (tag.color).
 *   • Name (truncated to 1 line).
 *   • Task count (number of attached task_tags rows) on the right.
 *
 * Tap → opens the cross-project filtered view (`/tags/<id>`).
 * Long-press → screen-level ActionSheet (Umbenennen / Farbe ändern / Löschen).
 */
export interface TagRowProps {
  tag: Tag;
  count: number;
  onPress: () => void;
  onLongPress: () => void;
}

export function TagRow({ tag, count, onPress, onLongPress }: TagRowProps): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="bg-white rounded-md border border-gray-200 px-3 py-2.5 flex-row items-center gap-3"
    >
      <View
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: tag.color }}
      />
      <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
        {tag.name}
      </Text>
      <Text className="text-[11px] text-gray-500 tabular-nums">
        {count}
      </Text>
    </Pressable>
  );
}
