import { useEffect, useRef } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { manualPull, setSyncState, useSync } from "@/stores/sync";

/**
 * Sync status pill rendered in screen headers (Today/Upcoming/Inbox/Projects).
 *
 * Task 22: subscribes to `useSync().state` (top-level lifecycle field) and
 * renders one of four states:
 *   - "idle":    green dot + "Sync"
 *   - "syncing": ActivityIndicator + "Sync…"
 *   - "error":   red dot + "Fehler"  (tap → Alert with `status.lastError`)
 *   - "offline": gray dot + "Offline"
 *
 * Tap:
 *   - "idle" / "error" / "offline" → trigger `manualPull()` (no-op if no
 *     engine; offline pulls still attempt — Supabase will surface the network
 *     error and the lifecycle code flips `state` to "error" with the message).
 *   - "syncing" → no-op (avoid stacking pulls).
 *   - "error"   → also shows the truncated last-error in an Alert before the
 *     pull starts, so the user can see what failed.
 *
 * NetInfo subscription:
 *   - On disconnect, flip `state` to "offline".
 *   - On reconnect, if the current `state` is "offline", flip back to "idle".
 *     We intentionally do NOT touch "error" or "syncing" — the lifecycle code
 *     owns those transitions.
 */
export function SyncStatusPill(): JSX.Element {
  const state = useSync((s) => s.state);
  const status = useSync((s) => s.status);
  // Hold the latest state in a ref so the NetInfo callback always reads the
  // current value without re-subscribing on every render.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const unsub = NetInfo.addEventListener((info) => {
      const connected = info.isConnected !== false; // null/undefined → assume connected
      if (!connected) {
        setSyncState("offline");
      } else if (stateRef.current === "offline") {
        setSyncState("idle");
      }
    });
    return () => { unsub(); };
  }, []);

  const onPress = (): void => {
    if (state === "syncing") return;
    if (state === "error" && status.lastError) {
      Alert.alert("Sync-Fehler", status.lastError);
    }
    void manualPull().catch(() => { /* lifecycle code records errors */ });
  };

  let label = "Sync";
  let bg = "bg-green-100";
  let fg = "text-green-700";
  let dot = "bg-green-500";
  if (state === "syncing") {
    label = "Sync…";
    bg = "bg-blue-100";
    fg = "text-blue-700";
    dot = "bg-blue-500";
  } else if (state === "error") {
    label = "Fehler";
    bg = "bg-red-100";
    fg = "text-red-700";
    dot = "bg-red-500";
  } else if (state === "offline") {
    label = "Offline";
    bg = "bg-gray-200";
    fg = "text-gray-700";
    dot = "bg-gray-500";
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Sync-Status: ${label}. Tippen zum Aktualisieren.`}
      className={`${bg} rounded-full px-2 py-0.5 flex-row items-center`}
    >
      {state === "syncing" ? (
        <ActivityIndicator size="small" color="#1d4ed8" />
      ) : (
        <View className={`w-1.5 h-1.5 rounded-full mr-1 ${dot}`} />
      )}
      <Text className={`text-[10px] font-medium ml-1 ${fg}`}>{label}</Text>
    </Pressable>
  );
}
