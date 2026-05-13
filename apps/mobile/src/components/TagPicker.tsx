import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTags } from "@/stores/tags";
import { ColorSwatchPopover, PROJECT_COLORS } from "./ColorSwatchPopover";

/**
 * Bottom-sheet tag picker for a single task. Shows all existing tags with
 * checkboxes reflecting attach state for the given task, plus an inline
 * "+ Neu" row that creates a new tag (name + color via ColorSwatchPopover) and
 * immediately attaches it.
 *
 * Attach / detach calls hit `useTags` directly — that store mirrors the
 * desktop tags IPC including the raw SQL for `task_tags` and the outbox
 * payload shape (`apps/desktop/src/main/ipc.ts` tags.attach / tags.detach).
 *
 * The set of currently-attached tag ids comes from `useTags().tagsForTask`
 * which is populated by `loadTagsForTask(taskId)` — we trigger that on mount
 * so the checkboxes are accurate on first render.
 */
export interface TagPickerProps {
  visible: boolean;
  taskId: string;
  onClose: () => void;
}

const EMPTY: readonly string[] = [];

export function TagPicker({ visible, taskId, onClose }: TagPickerProps): JSX.Element {
  const byId = useTags((s) => s.byId);
  const order = useTags((s) => s.order);
  const attachedIds = useTags((s) => s.tagsForTask[taskId] ?? EMPTY);
  const attach = useTags((s) => s.attach);
  const detach = useTags((s) => s.detach);
  const create = useTags((s) => s.create);

  const [composing, setComposing] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]!);
  const [swatchOpen, setSwatchOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      // Ensure the tags table and the attach cache are fresh whenever the
      // sheet opens. Both no-op cheaply if already loaded.
      void useTags.getState().refresh();
      void useTags.getState().loadTagsForTask(taskId);
      setComposing(false);
      setName("");
      setColor(PROJECT_COLORS[0]!);
    }
  }, [visible, taskId]);

  const tags = useMemo(
    () => order.map((id) => byId[id]).filter((t) => t !== undefined),
    [order, byId],
  );

  async function toggle(tagId: string): Promise<void> {
    try {
      if (attachedIds.includes(tagId)) await detach(taskId, tagId);
      else await attach(taskId, tagId);
    } catch (e) {
      Alert.alert("Fehler", (e as Error).message);
    }
  }

  async function createAndAttach(): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      setComposing(false);
      return;
    }
    try {
      const tag = await create({ name: trimmed, color });
      await attach(taskId, tag.id);
      setComposing(false);
      setName("");
    } catch (e) {
      Alert.alert("Fehler", (e as Error).message);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
      <Pressable onPress={onClose} className="flex-1 justify-end">
        <Pressable
          onPress={() => {}}
          className="bg-white rounded-t-2xl pb-6 pt-3 max-h-[80%] border border-gray-300"
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
          <Text className="text-base font-semibold text-ink px-4 pb-2">Tags</Text>

          {tags.length === 0 && !composing ? (
            <View className="px-4 py-6">
              <Text className="text-sm text-ink-muted text-center">
                Noch keine Tags. Tippe auf "+ Neu", um den ersten anzulegen.
              </Text>
            </View>
          ) : (
            <FlatList
              data={tags}
              keyExtractor={(t) => t!.id}
              renderItem={({ item }) => {
                const tag = item!;
                const on = attachedIds.includes(tag.id);
                return (
                  <Pressable
                    onPress={() => void toggle(tag.id)}
                    className="flex-row items-center gap-3 px-4 py-3 active:bg-gray-100"
                  >
                    <View
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <Text className="text-sm text-ink flex-1" numberOfLines={1}>
                      {tag.name}
                    </Text>
                    <View
                      className={`w-5 h-5 rounded border items-center justify-center ${
                        on ? "bg-pulse border-pulse" : "border-gray-400 bg-white"
                      }`}
                    >
                      {on ? <Text className="text-white text-xs">✓</Text> : null}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}

          {composing ? (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderTopWidth: 1,
                borderTopColor: "#E5E7EB",
              }}
            >
              <Pressable onPress={() => setSwatchOpen(true)} hitSlop={6}>
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.1)",
                    backgroundColor: color,
                  }}
                />
              </Pressable>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Tag-Name…"
                placeholderTextColor="#94A3B8"
                autoFocus
                onSubmitEditing={() => void createAndAttach()}
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: "#0F172A",
                  borderBottomWidth: 1,
                  borderBottomColor: "#2563EB",
                  paddingBottom: 4,
                }}
              />
              <Pressable
                onPress={() => void createAndAttach()}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                  backgroundColor: "#2563EB",
                }}
                hitSlop={6}
              >
                <Text style={{ fontSize: 12, fontWeight: "500", color: "#FFFFFF" }}>
                  Anlegen
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setComposing(true)}
              className="px-4 py-3 active:bg-gray-100 border-t border-gray-200"
            >
              <Text className="text-sm text-pulse">+ Neu</Text>
            </Pressable>
          )}

          <Pressable
            onPress={onClose}
            className="mx-4 mt-3 rounded-md bg-pulse py-2 items-center"
            hitSlop={8}
          >
            <Text className="text-sm font-medium text-white">Fertig</Text>
          </Pressable>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>

      <ColorSwatchPopover
        visible={swatchOpen}
        value={color}
        onPick={(c) => setColor(c)}
        onClose={() => setSwatchOpen(false)}
      />
    </Modal>
  );
}
