import { Text, View } from "react-native";
import { useSync } from "@/stores/sync";

/**
 * Minimal sync status pill rendered in screen headers (Today/Upcoming/Inbox).
 * Reads `useSync().status` and shows one of three labels:
 *   • "Sync"     — online, no error
 *   • "Offline"  — online === false
 *   • "Fehler"   — lastError set (overrides Offline)
 *
 * The richer DLQ/401 affordances land in Task 22 — keep this dumb for now.
 */
export function SyncStatusPill(): JSX.Element {
  const status = useSync((s) => s.status);
  let label = "Sync";
  let bg = "bg-green-100";
  let fg = "text-green-700";
  if (status.lastError) {
    label = "Fehler";
    bg = "bg-red-100";
    fg = "text-red-700";
  } else if (!status.online) {
    label = "Offline";
    bg = "bg-gray-200";
    fg = "text-gray-700";
  }
  return (
    <View className={`${bg} rounded-full px-2 py-0.5`}>
      <Text className={`text-[10px] font-medium ${fg}`}>{label}</Text>
    </View>
  );
}
