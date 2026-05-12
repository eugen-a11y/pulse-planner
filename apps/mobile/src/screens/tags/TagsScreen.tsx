import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Plus } from "lucide-react-native";
import type { Tag } from "@pulse/core";
import { useTags } from "@/stores/tags";
import { useDeps } from "@/wiring/depsContext";
import { TagRow } from "@/components/TagRow";
import { ColorSwatchPopover, PROJECT_COLORS } from "@/components/ColorSwatchPopover";
import { refreshAll } from "@/stores/refresh-all";

/**
 * Cross-project Tags screen (Task 15, Step 1+2). Mirrors the desktop
 * `apps/desktop/src/renderer/tags/TagsView.tsx` shape but adapted for touch:
 *
 *   • Header: back-button + "Tags" + "+" new-tag button.
 *   • FlatList of <TagRow>, alphabetical (already sorted by useTags.refresh).
 *   • Tap row → router.push("/tags/<id>") for the filtered task list.
 *   • Long-press → iOS ActionSheet:
 *       ["Umbenennen", "Farbe ändern", "Löschen", "Abbrechen"]
 *     Umbenennen → Alert.prompt (iOS).
 *     Farbe ändern → ColorSwatchPopover anchored to the long-pressed tag.
 *     Löschen → Alert.alert confirm → tags.remove(id).
 *   • Pull-to-refresh → engine.pull() + useTags.refresh() + reload counts.
 *
 * Task counts come from a single SQL aggregate
 * (`SELECT tag_id, COUNT(*) FROM task_tags GROUP BY tag_id`) and live in
 * local state — cheap, refreshed alongside the list.
 */
export function TagsScreen(): JSX.Element {
  const deps = useDeps();
  const router = useRouter();
  const byId = useTags((s) => s.byId);
  const order = useTags((s) => s.order);
  const create = useTags((s) => s.create);
  const update = useTags((s) => s.update);
  const remove = useTags((s) => s.remove);
  const [refreshing, setRefreshing] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [swatchTagId, setSwatchTagId] = useState<string | null>(null);

  const loadCounts = useCallback(async () => {
    const rows = await deps.db.getAllAsync<{ tag_id: string; cnt: number }>(
      "SELECT tag_id, COUNT(*) as cnt FROM task_tags GROUP BY tag_id",
    );
    const out: Record<string, number> = {};
    for (const r of rows) out[r.tag_id] = r.cnt;
    setCounts(out);
  }, [deps.db]);

  useEffect(() => {
    void useTags.getState().refresh();
    void loadCounts();
  }, [loadCounts]);

  const tags = useMemo<Tag[]>(() => {
    const out: Tag[] = [];
    for (const id of order) {
      const t = byId[id];
      if (t) out.push(t);
    }
    return out;
  }, [order, byId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (deps.engine) await deps.engine.pull();
      await useTags.getState().refresh();
      await loadCounts();
    } finally {
      setRefreshing(false);
    }
  }, [deps.engine, loadCounts]);

  function onAddPress(): void {
    if (Platform.OS === "ios" && typeof Alert.prompt === "function") {
      Alert.prompt(
        "Neuer Tag",
        "Name des Tags",
        async (name) => {
          const trimmed = (name ?? "").trim();
          if (!trimmed) return;
          try {
            await create({ name: trimmed });
            await loadCounts();
          } catch {
            // No toast surface on mobile yet (Task 22). Swallow per phase-3 spec.
          }
        },
        "plain-text",
        "",
      );
    } else {
      Alert.alert("Neuer Tag", "Bitte iOS verwenden — Android folgt später.");
    }
  }

  const onLongPress = useCallback(
    (tag: Tag) => {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Umbenennen", "Farbe ändern", "Löschen", "Abbrechen"],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 3,
          title: tag.name,
        },
        (idx) => {
          if (idx === 0) {
            if (Platform.OS === "ios" && typeof Alert.prompt === "function") {
              Alert.prompt(
                "Tag umbenennen",
                "Neuer Name",
                async (name) => {
                  const trimmed = (name ?? "").trim();
                  if (!trimmed || trimmed === tag.name) return;
                  try {
                    await update(tag.id, { name: trimmed });
                  } catch {
                    // swallow per phase-3 spec
                  }
                },
                "plain-text",
                tag.name,
              );
            }
          } else if (idx === 1) {
            setSwatchTagId(tag.id);
          } else if (idx === 2) {
            Alert.alert(
              "Tag löschen",
              `"${tag.name}" wirklich löschen? Verknüpfungen zu Tasks werden ebenfalls entfernt.`,
              [
                { text: "Abbrechen", style: "cancel" },
                {
                  text: "Löschen",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await remove(tag.id);
                      await loadCounts();
                    } catch {
                      // swallow per phase-3 spec
                    }
                  },
                },
              ],
            );
          }
        },
      );
    },
    [update, remove, loadCounts],
  );

  const swatchTag = swatchTagId ? byId[swatchTagId] : undefined;

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center px-2 py-3 border-b border-gray-200 gap-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Zurück"
        >
          <ChevronLeft color="#2563EB" size={26} />
        </Pressable>
        <Text className="text-2xl font-semibold text-ink flex-1">Tags</Text>
        <Pressable
          hitSlop={8}
          onPress={onAddPress}
          accessibilityLabel="Neuer Tag"
          className="px-2"
        >
          <Plus color="#2563EB" size={22} />
        </Pressable>
      </View>

      <FlatList
        data={tags}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <View className="mb-1.5">
            <TagRow
              tag={item}
              count={counts[item.id] ?? 0}
              onPress={() => router.push(`/tags/${item.id}` as never)}
              onLongPress={() => onLongPress(item)}
            />
          </View>
        )}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563EB"
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center px-8 py-12">
            <Text className="text-base text-ink-muted text-center">
              Noch keine Tags. Tippe auf +, um einen anzulegen.
            </Text>
          </View>
        }
      />

      <ColorSwatchPopover
        visible={swatchTag !== undefined}
        value={swatchTag?.color ?? PROJECT_COLORS[0]!}
        onPick={(color) => {
          if (swatchTagId) void update(swatchTagId, { color });
        }}
        onClose={() => setSwatchTagId(null)}
      />
    </View>
  );
}
