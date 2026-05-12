import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  View,
} from "react-native";
import { Search } from "lucide-react-native";
import { useRouter } from "expo-router";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import type { Task } from "@pulse/core";
import { useTasks } from "@/stores/tasks";
import { useDeps } from "@/wiring/depsContext";
import { TaskRow } from "@/components/TaskRow";
import { SyncStatusPill } from "@/components/SyncStatusPill";
import { refreshAll } from "@/stores/refresh-all";

/**
 * Upcoming screen. Mirrors apps/desktop/src/renderer/today/UpcomingView.tsx
 * but groups by date — easier to scan on a phone. Each section header is
 * formatted as "Mittwoch, 14. Mai" (German locale, "EEEE, d. MMMM").
 */
interface Section {
  title: string;
  data: Task[];
}

export function UpcomingScreen(): JSX.Element {
  const deps = useDeps();
  const router = useRouter();
  const ids = useTasks((s) => s.upcomingIds);
  const byId = useTasks((s) => s.byId);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void useTasks.getState().refreshUpcoming();
  }, []);

  const sections = useMemo<Section[]>(() => {
    const groups = new Map<string, Task[]>();
    for (const id of ids) {
      const t = byId[id];
      if (!t || !t.dueDate) continue;
      const key = t.dueDate.slice(0, 10); // yyyy-MM-dd
      const bucket = groups.get(key);
      if (bucket) bucket.push(t);
      else groups.set(key, [t]);
    }
    const sortedKeys = Array.from(groups.keys()).sort();
    return sortedKeys.map((key) => ({
      title: format(parseISO(key), "EEEE, d. MMMM", { locale: de }),
      data: groups.get(key) ?? [],
    }));
  }, [ids, byId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (deps.engine) await deps.engine.pull();
      await useTasks.getState().refreshUpcoming();
    } finally {
      setRefreshing(false);
    }
  }, [deps.engine]);

  const isEmpty = sections.length === 0;

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200 gap-3">
        <Text className="text-xl font-semibold text-ink flex-1">Demnächst</Text>
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
            Keine Tasks in den nächsten 7 Tagen.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(t) => t.id}
          renderSectionHeader={({ section }) => (
            <Text className="text-xs uppercase tracking-wide text-gray-500 mb-2 mt-2 bg-white">
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <View className="mb-1.5">
              <TaskRow task={item} />
            </View>
          )}
          contentContainerStyle={{ padding: 16 }}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />
          }
        />
      )}
    </View>
  );
}
