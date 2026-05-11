import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { buildDeps, type MobileDeps } from "@/wiring/deps";
import { DepsProvider } from "@/wiring/depsContext";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [deps, setDeps] = useState<MobileDeps | null>(null);

  useEffect(() => {
    (async () => {
      const d = await buildDeps();
      setDeps(d);
      await SplashScreen.hideAsync();
    })();
  }, []);

  if (!deps) return null;

  return (
    <DepsProvider value={deps}>
      <Stack screenOptions={{ headerShown: false }} />
    </DepsProvider>
  );
}
