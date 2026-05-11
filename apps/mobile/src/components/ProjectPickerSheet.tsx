import { useEffect, useMemo } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useProjects } from "@/stores/projects";

/**
 * Bottom-sheet style modal that lists all active (non-archived) projects and
 * lets the caller pick one. Used by the Inbox screen's long-press →
 * "Verschieben in Projekt…" action to re-home an inbox task.
 *
 * Implementation notes:
 *   • Backdrop is a tappable Pressable that closes the sheet.
 *   • Card is bottom-aligned via flex-end and rounded only at the top corners.
 *   • Refreshes the projects store on mount if it hasn't loaded yet — same
 *     pattern as TodayScreen.refreshToday().
 */
export interface ProjectPickerSheetProps {
  visible: boolean;
  onPick: (projectId: string) => void;
  onClose: () => void;
}

export function ProjectPickerSheet({
  visible,
  onPick,
  onClose,
}: ProjectPickerSheetProps): JSX.Element {
  const byId = useProjects((s) => s.byId);
  const order = useProjects((s) => s.order);
  const loaded = useProjects((s) => s.loaded);

  useEffect(() => {
    if (visible && !loaded) void useProjects.getState().refresh();
  }, [visible, loaded]);

  const projects = useMemo(
    () => order.map((id) => byId[id]).filter((p) => p && !p.archived),
    [order, byId],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        className="flex-1 justify-end bg-black/40"
      >
        <Pressable
          // Stop tap-through so taps on the card don't close the sheet.
          onPress={() => {}}
          className="bg-white rounded-t-2xl pb-6 pt-3 max-h-[70%]"
        >
          <View className="items-center pb-2">
            <View className="w-10 h-1 rounded-full bg-gray-300" />
          </View>
          <Text className="text-base font-semibold text-ink px-4 pb-2">
            Verschieben in Projekt…
          </Text>
          {projects.length === 0 ? (
            <View className="px-4 py-6">
              <Text className="text-sm text-ink-muted text-center">
                Keine Projekte vorhanden.
              </Text>
            </View>
          ) : (
            <FlatList
              data={projects}
              keyExtractor={(p) => p!.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onPick(item!.id);
                  }}
                  className="flex-row items-center gap-3 px-4 py-3 active:bg-gray-100"
                >
                  <View
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item!.color }}
                  />
                  <Text className="text-sm text-ink flex-1" numberOfLines={1}>
                    {item!.name}
                  </Text>
                </Pressable>
              )}
            />
          )}
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
