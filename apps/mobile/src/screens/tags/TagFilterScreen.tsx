import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { Task } from "@pulse/core";
import { useTags } from "@/stores/tags";
import { useTasks } from "@/stores/tasks";
import { useDeps } from "@/wiring/depsContext";
import { TaskRow } from "@/components/TaskRow";
import { groupTasks, TaskSectionHeader } from "@/components/TaskSectionList";
import { refreshAll } from "@/stores/refresh-all";

/**
 * Cross-project filtered task list for a single tag (Task 15, Step 1 follow-up).
 *
 *   • Resolves the tag id from `useLocalSearchParams<{ id: string }>()`.
 *   • Queries `task_tags` directly via SQL for the set of task ids carrying the
 *     tag, then resolves each via `useTasks().byId`. If a task isn't hydrated
 *     locally we trigger a one-shot refresh of Today/Upcoming/Inbox (so the
 *     index is broadly warm) and re-query.
 *   • Pull-to-refresh: engine.pull() → re-fetch SQL set → re-render.
 *   • Empty state copy: "Keine Tasks mit diesem Tag."
 *
 * No write affordances live on this screen — long-press still hits TaskRow's
 * own ActionSheet (Erledigen / Löschen). Bulk-tag operations are explicitly
 * out of scope per Eugen's "stick to spec" rule.
 */
export function TagFilterScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const deps = useDeps();
  const tag = useTags((s) => (id ? s.byId[id] : undefined));
  const tagsLoaded = useTags((s) => s.order.length > 0);
  const byId = useTasks((s) => s.byId);
  const [taskIds, setTaskIds] = useState<string[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const triedHydrate = useRef(false);

  const loadTaskIds = useCallback(async (): Promise<string[]> => {
    if (!id) return [];
    const rows = await deps.db.getAllAsync<{ task_id: string }>(
      "SELECT task_id FROM task_tags WHERE tag_id = ?",
      id,
    );
    const ids = rows.map((r) => r.task_id);
    setTaskIds(ids);
    return ids;
  }, [deps.db, id]);

  useEffect(() => {
    if (!tagsLoaded) void useTags.getState().refresh();
  }, [tagsLoaded]);

  useEffect(() => {
    void loadTaskIds();
  }, [loadTaskIds]);

  // If any task referenced by task_tags isn't in the in-memory store yet,
  // do a one-shot hydrate: refresh Today/Upcoming/Inbox covers the common
  // cases without needing a brand-new "refreshAll-tasks" action.
  useEffect(() => {
    if (!taskIds || taskIds.length === 0) return;
    if (triedHydrate.current) return;
    const missing = taskIds.some((tid) => !byId[tid]);
    if (!missing) return;
    triedHydrate.current = true;
    (async () => {
      await Promise.all([
        useTasks.getState().refreshToday(),
        useTasks.getState().refreshUpcoming(),
        useTasks.getState().refreshInbox(),
      ]);
    })().catch(() => {
      // swallow per phase-3 spec
    });
  }, [taskIds, byId]);

  const tasks = useMemo<Task[]>(() => {
    if (!taskIds) return [];
    const out: Task[] = [];
    for (const tid of taskIds) {
      const t = byId[tid];
      if (t && t.deletedAt === null) out.push(t);
    }
    // Sort: unfinished first, then by dueDate asc (nulls last), then by title.
    out.sort((a, b) => {
      const aDone = a.status === "done" ? 1 : 0;
      const bDone = b.status === "done" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      const ad = a.dueDate ?? "￿";
      const bd = b.dueDate ?? "￿";
      if (ad !== bd) return ad < bd ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
    return out;
  }, [taskIds, byId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (deps.engine) await deps.engine.pull();
      await loadTaskIds();
    } finally {
      setRefreshing(false);
    }
  }, [deps.engine, loadTaskIds]);

  if (!id) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-8">
        <Text className="text-base text-ink-muted text-center">
          Kein Tag ausgewählt.
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-3 px-4 py-2 rounded-md border border-gray-300"
        >
          <Text className="text-sm text-ink">Zurück</Text>
        </Pressable>
      </View>
    );
  }

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
        {tag ? (
          <>
            <View
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            <Text className="text-2xl font-semibold text-ink flex-1" numberOfLines={1}>
              {tag.name}
            </Text>
          </>
        ) : (
          <Text className="text-2xl font-semibold text-ink flex-1">Tag</Text>
        )}
      </View>

      {taskIds === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={groupTasks(tasks)}
          keyExtractor={(r) => (r.type === "header" ? r.key : r.task.id)}
          renderItem={({ item }) =>
            item.type === "header" ? (
              <TaskSectionHeader label={item.label} count={item.count} muted={item.muted} />
            ) : (
              <View className="mb-1.5" style={item.done ? { opacity: 0.55 } : undefined}>
                <TaskRow task={item.task} />
              </View>
            )
          }
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
                Keine Tasks mit diesem Tag.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
