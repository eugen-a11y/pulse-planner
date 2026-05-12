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
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { Task } from "@pulse/core";
import { useTasks } from "@/stores/tasks";
import { useDeps } from "@/wiring/depsContext";
import { TaskRow } from "@/components/TaskRow";
import { SyncStatusPill } from "@/components/SyncStatusPill";
import { QuickAddSheet } from "@/components/QuickAddSheet";
import { TaskFAB } from "@/components/TaskFAB";

/**
 * Today screen. Mirrors apps/desktop/src/renderer/today/TodayView.tsx structure:
 * overdue tasks first, then today's tasks. The store's `todayIds` already
 * contains both (anything with `dueDate <= todayEnd` and not done), so we
 * split client-side using `dueDate < today-start`.
 *
 * Pull-to-refresh triggers `engine.pull()` and the empty state mirrors the
 * desktop copy.
 */
type Section = "overdue" | "today";
type Row =
  | { kind: "header"; section: Section }
  | { kind: "item"; task: Task };

export function TodayScreen(): JSX.Element {
  const deps = useDeps();
  const router = useRouter();
  const ids = useTasks((s) => s.todayIds);
  const byId = useTasks((s) => s.byId);
  const [refreshing, setRefreshing] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  useEffect(() => {
    void useTasks.getState().refreshToday();
  }, []);

  const { overdue, today } = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const cutoff = startOfToday.toISOString();
    const overdue: Task[] = [];
    const today: Task[] = [];
    for (const id of ids) {
      const t = byId[id];
      if (!t) continue;
      if (t.dueDate && t.dueDate < cutoff) overdue.push(t);
      else today.push(t);
    }
    return { overdue, today };
  }, [ids, byId]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (overdue.length > 0) {
      out.push({ kind: "header", section: "overdue" });
      for (const t of overdue) out.push({ kind: "item", task: t });
    }
    if (today.length > 0) {
      out.push({ kind: "header", section: "today" });
      for (const t of today) out.push({ kind: "item", task: t });
    }
    return out;
  }, [overdue, today]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (deps.engine) await deps.engine.pull();
      await useTasks.getState().refreshToday();
    } finally {
      setRefreshing(false);
    }
  }, [deps.engine]);

  const weekday = format(new Date(), "EEEE", { locale: de });
  const isEmpty = overdue.length === 0 && today.length === 0;

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200 gap-3">
        <Text className="text-xl font-semibold text-ink flex-1">Heute · {weekday}</Text>
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
            Nichts mehr für heute. Schön.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) =>
            r.kind === "header" ? `h:${r.section}` : `t:${r.task.id}:${i}`
          }
          renderItem={({ item }) => {
            if (item.kind === "header") {
              const label = item.section === "overdue" ? "Überfällig" : "Heute fällig";
              const cls =
                item.section === "overdue"
                  ? "text-xs uppercase tracking-wide text-red-600 mb-2 mt-2"
                  : "text-xs uppercase tracking-wide text-gray-500 mb-2 mt-2";
              return <Text className={cls}>{label}</Text>;
            }
            return (
              <View className="mb-1.5">
                <TaskRow task={item.task} />
              </View>
            );
          }}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />
          }
        />
      )}

      <TaskFAB onPress={() => setQuickAddOpen(true)} />

      <QuickAddSheet
        visible={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        defaultProjectId={null}
      />
    </View>
  );
}
