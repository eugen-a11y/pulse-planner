import { Pressable, Text, View } from "react-native";

/**
 * Tiny reusable empty-state placeholder. Used by tab stubs (Task 10) until the
 * individual screens land in Tasks 11-18. Centered text only — no graphic, no
 * illustration. NativeWind classes only.
 */
export interface EmptyStateProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ title, subtitle, action }: EmptyStateProps): JSX.Element {
  return (
    <View className="flex-1 items-center justify-center bg-white px-8">
      <Text className="text-xl font-semibold text-ink">{title}</Text>
      {subtitle ? (
        <Text className="text-sm text-ink-muted mt-2 text-center">{subtitle}</Text>
      ) : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          className="rounded-md bg-pulse px-4 py-2 mt-4"
          hitSlop={8}
        >
          <Text className="text-white text-sm font-medium">{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
