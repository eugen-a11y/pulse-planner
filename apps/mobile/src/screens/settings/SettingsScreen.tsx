import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import * as Application from "expo-application";
import * as Notifications from "expo-notifications";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { useAuth, useSync, manualPull } from "@/stores";
import { ChevronRight } from "lucide-react-native";
import { useDeps } from "@/wiring/depsContext";
import { readDebugLog } from "@/lib/debugLog";

/**
 * SettingsScreen. Read-only Konto + Sync controls + Erinnerungen (notification
 * permission gate) + Über (app version via expo-application) + Debug (export
 * non-sensitive log JSON via Sharing.shareAsync).
 *
 * Logout flow: confirm dialog → useAuth.signOut() (clears engine + userId via
 * deps) → Notifications.cancelAllScheduledNotificationsAsync() (best-effort) →
 * router.replace("/auth/login"). The route guard in app/_layout.tsx ALSO
 * redirects on session=null; the explicit push here just makes the redirect
 * immediate. Local SQLite is intentionally kept per spec (re-login restores
 * everything via SyncEngine.pull).
 *
 * Debug export builds a small JSON blob ({ deviceInfo, lastSync, lastError,
 * outboxSize, env }) and writes it to documentDirectory, then opens the iOS
 * share sheet via expo-sharing. Access tokens are intentionally NOT included.
 */
type NotifStatus = "granted" | "denied" | "undetermined";

export function SettingsScreen(): JSX.Element {
  const deps = useDeps();
  const router = useRouter();
  const session = useAuth((s) => s.session);
  const status = useSync((s) => s.status);

  const [pulling, setPulling] = useState(false);
  const [notifStatus, setNotifStatus] = useState<NotifStatus>("undetermined");
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await Notifications.getPermissionsAsync();
        setNotifStatus(r.status as NotifStatus);
      } catch {
        setNotifStatus("undetermined");
      }
    })();
  }, []);

  const email = session?.user.email ?? "—";

  const lastSyncLabel = status.lastPullAt
    ? formatDistanceToNow(new Date(status.lastPullAt), { locale: de, addSuffix: true })
    : "Noch nie";

  const onPull = useCallback(async () => {
    if (pulling) return;
    setPulling(true);
    try {
      await manualPull();
    } catch {
      // patchStatus already records errors elsewhere; swallow per spec.
    } finally {
      setPulling(false);
    }
  }, [pulling]);

  const onLogout = useCallback(() => {
    Alert.alert(
      "Wirklich abmelden?",
      "Du wirst zum Login zurückgeschickt. Lokale Daten bleiben auf dem Gerät.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Abmelden",
          style: "destructive",
          onPress: async () => {
            try {
              // signOut() clears userId + engine on deps. The root layout
              // lifecycle effect unsubscribes realtime when session flips.
              await useAuth.getState().signOut();
            } catch {
              // ignore — proceed with local-only cleanup anyway
            }
            try {
              await Notifications.cancelAllScheduledNotificationsAsync();
            } catch {
              // expo-notifications may be unavailable in dev client; ignore
            }
            // Explicit redirect for immediate feedback; the route guard would
            // also redirect on the next render.
            router.replace("/auth/login");
          },
        },
      ],
    );
  }, [router]);

  const onToggleNotif = useCallback(async (next: boolean) => {
    if (!next) {
      // iOS apps can't revoke their own notification permission — direct the
      // user to Settings. If already denied, this is a no-op for the toggle
      // but Linking.openSettings keeps the affordance consistent.
      await Linking.openSettings().catch(() => {});
      return;
    }
    try {
      const r = await Notifications.requestPermissionsAsync();
      setNotifStatus(r.status as NotifStatus);
      if (r.status === "denied") {
        await Linking.openSettings().catch(() => {});
      }
    } catch {
      setNotifStatus("undetermined");
    }
  }, []);

  const onExportLog = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Background-fetch + boot trace lines. Best-effort — empty string if
      // the file doesn't exist yet (first run) or is unreadable.
      const bgLog = await readDebugLog();
      const debug = {
        deviceInfo: {
          platform: Platform.OS,
          osVersion: Platform.Version,
          appVersion: Application.nativeApplicationVersion,
          buildVersion: Application.nativeBuildVersion,
          bundleId: Application.applicationId,
        },
        lastSync: {
          lastPullAt: status.lastPullAt,
          lastPushAt: status.lastPushAt,
        },
        lastError: status.lastError,
        outboxSize: status.outboxSize,
        env: {
          // Non-sensitive: project URL only. Anon key is public but we still
          // exclude it here because logs may be shared with third parties.
          supabaseUrl: (deps.supabase as unknown as { rest?: { url?: string } })?.rest?.url ?? null,
        },
        userId: deps.userId ?? null,
        backgroundFetchLog: bgLog,
      };
      const uri = `${FileSystem.documentDirectory ?? ""}pulse-debug.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(debug, null, 2));
      const avail = await Sharing.isAvailableAsync();
      if (!avail) {
        Alert.alert("Teilen nicht verfügbar", "Auf diesem Gerät kann der Log nicht geteilt werden.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "application/json",
        dialogTitle: "Pulse Debug-Log",
        UTI: "public.json",
      });
    } catch (e) {
      Alert.alert("Fehler", (e as Error).message);
    } finally {
      setExporting(false);
    }
  }, [deps, exporting, status.lastError, status.lastPullAt, status.lastPushAt, status.outboxSize]);

  const onDeleteAccount = useCallback(() => {
    // Two-stage confirm: irreversible action with server-side cascade.
    Alert.alert(
      "Konto löschen?",
      "Alle deine Projekte, Aufgaben, Tags und Kommentare werden unwiederbringlich aus der Cloud gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Weiter",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Wirklich endgültig löschen?",
              "Letzte Bestätigung. Danach ist dein Konto weg.",
              [
                { text: "Abbrechen", style: "cancel" },
                {
                  text: "Endgültig löschen",
                  style: "destructive",
                  onPress: async () => {
                    if (deleting) return;
                    setDeleting(true);
                    try {
                      const { error } = await deps.supabase.rpc("delete_account");
                      if (error) throw new Error(error.message);
                      try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* ignore */ }
                      // Wipe local SQLite so a different account on the same device
                      // starts clean. sync_state included so next signIn pulls from 0.
                      try {
                        await deps.db.execAsync(`
                          DELETE FROM task_tags;
                          DELETE FROM comments;
                          DELETE FROM notes;
                          DELETE FROM time_entries;
                          DELETE FROM attachments;
                          DELETE FROM tasks;
                          DELETE FROM projects;
                          DELETE FROM tags;
                          DELETE FROM sync_state;
                        `);
                      } catch { /* ignore — best-effort local wipe */ }
                      try { await useAuth.getState().signOut(); } catch { /* ignore */ }
                      router.replace("/auth/login");
                    } catch (e) {
                      Alert.alert("Fehler", (e as Error).message);
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, [deps, deleting, router]);

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
      <Text className="text-2xl font-semibold text-ink mb-4">Einstellungen</Text>

      {/* Konto */}
      <SectionHeader title="Konto" />
      <Card>
        <Row label="E-Mail" value={email} />
      </Card>

      {/* Sync */}
      <SectionHeader title="Sync" />
      <Card>
        <Row label="Zuletzt synchronisiert" value={lastSyncLabel} />
        <Divider />
        <Pressable
          onPress={onPull}
          disabled={pulling}
          className="px-4 py-3 flex-row items-center justify-between"
          accessibilityRole="button"
        >
          <Text className="text-pulse text-base">Jetzt synchronisieren</Text>
          {pulling ? <ActivityIndicator color="#2563EB" /> : null}
        </Pressable>
        {status.lastError ? (
          <View className="px-4 pb-3">
            <Text className="text-xs text-red-600">{status.lastError}</Text>
          </View>
        ) : null}
        <Divider />
        <Pressable
          onPress={() => { router.push("/settings/dlq" as never); }}
          className="px-4 py-3 flex-row items-center justify-between"
          accessibilityRole="button"
        >
          <Text className="text-base text-ink">Fehlgeschlagene Sync-Items</Text>
          <View className="flex-row items-center">
            {status.outboxSize > 0 ? (
              <View className="bg-red-100 rounded-full px-2 py-0.5 mr-2">
                <Text className="text-xs font-medium text-red-700">{status.outboxSize}</Text>
              </View>
            ) : null}
            <ChevronRight size={18} color="#9ca3af" />
          </View>
        </Pressable>
      </Card>

      {/* Erinnerungen */}
      <SectionHeader title="Erinnerungen" />
      <Card>
        <View className="px-4 py-3 flex-row items-center justify-between">
          <Text className="text-base text-ink flex-1 pr-3">Push-Benachrichtigungen</Text>
          <Switch value={notifStatus === "granted"} onValueChange={onToggleNotif} />
        </View>
        {notifStatus === "denied" ? (
          <>
            <Divider />
            <Pressable
              onPress={() => { void Linking.openSettings(); }}
              className="px-4 py-3"
              accessibilityRole="button"
            >
              <Text className="text-pulse text-base">Öffne iOS-Einstellungen</Text>
            </Pressable>
          </>
        ) : null}
      </Card>

      {/* Über */}
      <SectionHeader title="Über" />
      <Card>
        <Row label="Version" value={Application.nativeApplicationVersion ?? "—"} />
        <Divider />
        <Row label="Build" value={Application.nativeBuildVersion ?? "—"} />
      </Card>

      {/* Debug */}
      <SectionHeader title="Debug" />
      <Card>
        <Pressable
          onPress={onExportLog}
          disabled={exporting}
          className="px-4 py-3 flex-row items-center justify-between"
          accessibilityRole="button"
        >
          <Text className="text-pulse text-base">Log exportieren</Text>
          {exporting ? <ActivityIndicator color="#2563EB" /> : null}
        </Pressable>
      </Card>

      {/* Logout pinned to the bottom — destructive action below everything. */}
      <View className="h-8" />
      <Card>
        <Pressable onPress={onLogout} className="px-4 py-3" accessibilityRole="button">
          <Text className="text-red-600 text-base">Abmelden</Text>
        </Pressable>
      </Card>

      <View className="h-3" />
      <Card>
        <Pressable
          onPress={onDeleteAccount}
          disabled={deleting}
          className="px-4 py-3 flex-row items-center justify-between"
          accessibilityRole="button"
        >
          <Text className="text-red-600 text-base">Konto löschen</Text>
          {deleting ? <ActivityIndicator color="#dc2626" /> : null}
        </Pressable>
      </Card>

      <View className="h-8" />
    </ScrollView>
  );
}

function SectionHeader({ title }: { title: string }): JSX.Element {
  return (
    <Text className="text-xs uppercase tracking-wide text-ink-muted mt-4 mb-2 px-1">
      {title}
    </Text>
  );
}

function Card({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <View className="bg-white rounded-md border border-gray-200 overflow-hidden">
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View className="px-4 py-3 flex-row items-center justify-between">
      <Text className="text-base text-ink flex-1 pr-3">{label}</Text>
      <Text className="text-base text-ink-muted" numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Divider(): JSX.Element {
  return <View className="h-hairline bg-gray-200 ml-4" />;
}
