import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import { buildDeps, type MobileDeps } from "@/wiring/deps";
import { DepsProvider } from "@/wiring/depsContext";
import { bindStoresToDeps, refreshAll, useAuth, patchStatus } from "@/stores";

SplashScreen.preventAutoHideAsync();

/**
 * Root layout. Boots MobileDeps, binds Zustand stores, restores any persisted
 * auth session, and wires the sync lifecycle (realtime + 60s backstop) keyed
 * to AppState.
 *
 * Notes vs desktop:
 *  - `Outbox` has no pause/resume/start/stop today, so step 3 of Task 8 ("outbox
 *    pause/resume on AppState") is a no-op here. We still cycle the realtime
 *    subscription on AppState transitions, which is the load-bearing piece.
 *    Follow-up: add Outbox.pause/resume in @pulse/core if EAS Build flagging
 *    or battery telemetry shows the pull-only background loop is too chatty.
 *  - The /auth/login route doesn't exist yet (Task 9). The 401 handler still
 *    routes there via `router.replace("/auth/login")` so that, once the screen
 *    lands, the redirect already works.
 */
export default function RootLayout() {
  const [deps, setDeps] = useState<MobileDeps | null>(null);
  const router = useRouter();
  const session = useAuth((s) => s.session);
  const authLoading = useAuth((s) => s.loading);
  const realtimeUnsubRef = useRef<(() => void) | null>(null);
  const pendingPullRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backstopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      const d = await buildDeps();
      bindStoresToDeps(d);
      // Best-effort restore (no-op if rememberMe=false). Doesn't throw.
      await useAuth.getState().restore();
      setDeps(d);
      await SplashScreen.hideAsync();
    })();
  }, []);

  // Sync lifecycle wiring. Mirrors `apps/desktop/src/main/ipc.ts` 30-72:
  // realtime sub with 500ms debounce → refreshAll, 60s backstop.
  useEffect(() => {
    if (!deps) return;

    async function pullAndRefresh(): Promise<void> {
      if (!deps!.engine) return;
      try {
        await deps!.engine.pull();
        await refreshAll(deps!);
        await patchStatus({ lastPullAt: new Date().toISOString(), lastError: null });
      } catch (e) {
        const msg = (e as Error).message;
        if (/401|unauthor|jwt/i.test(msg)) {
          await useAuth.getState().signOut();
          stopBackgroundSync();
          router.replace("/auth/login");
          return;
        }
        await patchStatus({ lastError: msg });
      }
    }

    function startBackgroundSync(): void {
      stopBackgroundSync();
      if (!deps!.engine) return;
      void pullAndRefresh();
      realtimeUnsubRef.current = deps!.engine.subscribeRealtime(() => {
        if (pendingPullRef.current) return;
        pendingPullRef.current = setTimeout(() => {
          pendingPullRef.current = null;
          void pullAndRefresh();
        }, 500);
      });
      backstopRef.current = setInterval(() => { void pullAndRefresh(); }, 60_000);
    }

    function stopBackgroundSync(): void {
      if (realtimeUnsubRef.current) { realtimeUnsubRef.current(); realtimeUnsubRef.current = null; }
      if (backstopRef.current)      { clearInterval(backstopRef.current); backstopRef.current = null; }
      if (pendingPullRef.current)   { clearTimeout(pendingPullRef.current); pendingPullRef.current = null; }
    }

    function onAppStateChange(state: AppStateStatus): void {
      if (state === "active") {
        startBackgroundSync();
      } else if (state === "background" || state === "inactive") {
        stopBackgroundSync();
      }
    }

    // Initial start (we're active when mount happens). This effect re-runs
    // when `session` flips (sign-in / sign-out / token refresh), so an
    // in-session sign-in immediately starts the realtime sub on its rerun —
    // matching desktop's `startBackgroundSync()` call inside the auth.signIn
    // IPC handler (apps/desktop/src/main/ipc.ts:86).
    if (AppState.currentState === "active") startBackgroundSync();
    const sub = AppState.addEventListener("change", onAppStateChange);
    return () => {
      sub.remove();
      stopBackgroundSync();
    };
  }, [deps, router, session]);

  // Route guard. Once deps are resolved and the initial restore() has
  // completed (loading === false), redirect to /auth/login when there is no
  // active session. Re-runs on session change: sign-in flips session → guard
  // is a no-op; sign-out flips session → guard redirects.
  useEffect(() => {
    if (!deps) return;
    if (authLoading) return;
    if (!session) router.replace("/auth/login");
  }, [deps, session, authLoading, router]);

  // Deep-link handler. Supports:
  //   pulse://task/<id>  → /task/<id>   (Task 14 lands the screen)
  //   pulse://today      → /(tabs)/today
  // Runs once we have deps + an authenticated session — otherwise the route
  // guard above will redirect to /auth/login before any push lands. Handles
  // cold-start (initial URL) and warm "url" events.
  useEffect(() => {
    if (!deps || !session) return;

    function handleUrl(url: string | null): void {
      if (!url) return;
      const { hostname, path } = Linking.parse(url);
      if (hostname === "task" && path) {
        router.push(`/task/${path}` as never);
      } else if (hostname === "today") {
        router.push("/(tabs)/today" as never);
      }
    }

    void Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener("url", (e) => handleUrl(e.url));
    return () => {
      sub.remove();
    };
  }, [deps, session, router]);

  if (!deps) return null;

  return (
    <DepsProvider value={deps}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="project/[id]" />
      </Stack>
    </DepsProvider>
  );
}
