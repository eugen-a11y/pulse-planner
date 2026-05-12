import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { OutboxEntry } from "@pulse/core";
import { useDeps } from "@/wiring/depsContext";
import { patchStatus, setSyncState } from "@/stores/sync";

/**
 * DLQ ("Dead-Letter Queue") screen — Task 22, Step 2.
 *
 * Lists outbox entries that have failed at least once (`attempts > 0` or
 * `lastError` set). The in-memory `Outbox` from `@pulse/core` doesn't
 * persist across restarts, so the list is naturally bounded by the current
 * session's failure history. That's fine for the MVP — the desktop client
 * has the same shape.
 *
 * Row actions:
 *  - "Wiederholen": kicks off `engine.push()` which re-attempts every
 *    pending entry in FIFO order. We do NOT reset `attempts` — the engine
 *    will increment it again on the next failure, which is the correct
 *    accounting.
 *  - "Verwerfen": pops the entry off the queue via `outbox.discard(id)`.
 *    Confirms first because this is destructive — the local change has
 *    already been written to SQLite, but the cloud sync for it is being
 *    abandoned, so the next pull may overwrite or diverge.
 *
 * Refresh: pull-to-refresh re-reads from `outbox.peekAll()`. There's no
 * subscribe-to-outbox API today; we re-read after every action.
 */
export function DLQScreen(): JSX.Element {
  const deps = useDeps();
  const router = useRouter();
  const [items, setItems] = useState<OutboxEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await deps.outbox.peekAll();
      const failed = all.filter((e) => e.attempts > 0 || !!e.lastError);
      setItems(failed);
    } catch {
      setItems([]);
    }
  }, [deps]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onRetry = useCallback(async (entry: OutboxEntry) => {
    if (busy) return;
    setBusy(true);
    try {
      setSyncState("syncing");
      if (deps.engine) {
        await deps.engine.push();
        await patchStatus({ lastPushAt: new Date().toISOString(), lastError: null });
      }
      setSyncState("idle");
    } catch (e) {
      await patchStatus({ lastError: (e as Error).message });
      setSyncState("error");
    } finally {
      setBusy(false);
      await load();
    }
    void entry; // entry was only used to surface intent in UI; push drains all
  }, [busy, deps, load]);

  const onDiscard = useCallback((entry: OutboxEntry) => {
    Alert.alert(
      "Sync-Eintrag verwerfen?",
      `${entry.entityTable} / ${entry.entityId.slice(0, 8)} — wirklich verwerfen? Die lokale Änderung wird nicht mehr in die Cloud geschickt.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Verwerfen",
          style: "destructive",
          onPress: async () => {
            try {
              await deps.outbox.discard(entry.queuedAt);
              await patchStatus({}); // refresh outboxSize
            } catch {
              // best-effort; ignore
            } finally {
              await load();
            }
          },
        },
      ],
    );
  }, [deps, load]);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="flex-row items-center px-2 pt-12 pb-3 bg-white border-b border-gray-200">
        <Pressable
          onPress={() => router.back()}
          className="px-2 py-1"
          accessibilityRole="button"
          accessibilityLabel="Zurück"
        >
          <ChevronLeft size={24} color="#1f2937" />
        </Pressable>
        <Text className="text-lg font-semibold text-ink ml-1">Fehlgeschlagene Sync-Items</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(e) => e.queuedAt}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View className="px-6 py-16 items-center">
            <Text className="text-base text-ink-muted text-center">
              Keine fehlgeschlagenen Sync-Items.
            </Text>
            <Text className="text-xs text-ink-muted text-center mt-2">
              Alles synchronisiert oder noch nicht versucht.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-white border-b border-gray-200 px-4 py-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium text-ink">
                {item.entityTable} · {item.op}
              </Text>
              <Text className="text-xs text-ink-muted">
                {item.attempts}× versucht
              </Text>
            </View>
            <Text className="text-xs text-ink-muted mt-0.5" numberOfLines={1}>
              id: {item.entityId}
            </Text>
            {item.lastError ? (
              <Text className="text-xs text-red-600 mt-1" numberOfLines={2}>
                {item.lastError}
              </Text>
            ) : null}
            <View className="flex-row mt-2">
              <Pressable
                onPress={() => { void onRetry(item); }}
                disabled={busy}
                className="bg-pulse rounded-md px-3 py-1.5 mr-2"
                accessibilityRole="button"
              >
                <Text className="text-white text-xs font-medium">Wiederholen</Text>
              </Pressable>
              <Pressable
                onPress={() => onDiscard(item)}
                className="bg-red-100 rounded-md px-3 py-1.5"
                accessibilityRole="button"
              >
                <Text className="text-red-700 text-xs font-medium">Verwerfen</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}
