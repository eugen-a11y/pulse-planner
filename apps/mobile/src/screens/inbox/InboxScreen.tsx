import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { Plus, Search } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { Task } from "@pulse/core";
import { useTasks } from "@/stores/tasks";
import { useDeps } from "@/wiring/depsContext";
import { TaskRow } from "@/components/TaskRow";
import { SyncStatusPill } from "@/components/SyncStatusPill";
import { ProjectPickerSheet } from "@/components/ProjectPickerSheet";
import { QuickAddSheet } from "@/components/QuickAddSheet";
import { TaskFAB } from "@/components/TaskFAB";
import { refreshAll } from "@/stores/refresh-all";

/**
 * Inbox screen. Mirrors apps/desktop/src/renderer/inbox/InboxView.tsx in shape
 * (not JSX): lists tasks where `projectId === null` from the tasks store.
 *
 *   • Pull-to-refresh triggers `engine.pull()` then `refreshInbox()`.
 *   • Long-press on a TaskRow opens an ActionSheet that includes a
 *     "Verschieben in Projekt…" action — selecting it opens
 *     <ProjectPickerSheet/> and `tasks.update(id, { projectId })` moves the
 *     task to the chosen project.
 *   • EmptyState is the standard "Inbox ist leer." copy.
 *
 * Quick-Add and Search buttons in the header are placeholders (Task 17/16).
 */
export function InboxScreen(): JSX.Element {
  const deps = useDeps();
  const router = useRouter();
  const ids = useTasks((s) => s.inboxIds);
  const byId = useTasks((s) => s.byId);
  const update = useTasks((s) => s.update);
  const [refreshing, setRefreshing] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  useEffect(() => {
    void useTasks.getState().refreshInbox();
  }, []);

  const tasks = useMemo<Task[]>(() => {
    const out: Task[] = [];
    for (const id of ids) {
      const t = byId[id];
      // Defensive: the store filters by projectId === null already, but a
      // stale `inboxIds` after move could leak — re-check here too.
      if (t && t.projectId === null) out.push(t);
    }
    return out;
  }, [ids, byId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (deps.engine) await deps.engine.pull();
      await refreshAll(deps);
    } finally {
      setRefreshing(false);
    }
  }, [deps]);

  const onMove = useCallback(
    async (projectId: string) => {
      const id = movingId;
      setMovingId(null);
      if (!id) return;
      try {
        await update(id, { projectId });
      } catch {
        // No toast surface on mobile yet (Task 22). Swallow per phase-3 spec.
      }
    },
    [movingId, update],
  );

  const isEmpty = tasks.length === 0;

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200 gap-3">
        <Text className="text-xl font-semibold text-ink flex-1">Inbox</Text>
        <SyncStatusPill />
        <Pressable
          hitSlop={8}
          onPress={() => router.push("/search" as never)}
          accessibilityLabel="Suchen"
        >
          <Search color="#475569" size={20} />
        </Pressable>
      </View>

      {isEmpty ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base text-ink-muted text-center">
            Inbox ist leer.
          </Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <View className="mb-1.5">
              <TaskRow
                task={item}
                extraActions={[
                  {
                    label: "Verschieben in Projekt…",
                    onPress: () => setMovingId(item.id),
                  },
                ]}
              />
            </View>
          )}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2563EB"
            />
          }
        />
      )}

      <TaskFAB onPress={() => setQuickAddOpen(true)} />

      <ProjectPickerSheet
        visible={movingId !== null}
        onPick={onMove}
        onClose={() => setMovingId(null)}
      />

      <QuickAddSheet
        visible={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        defaultProjectId={null}
      />
    </View>
  );
}
