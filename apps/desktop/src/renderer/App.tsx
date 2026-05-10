import { useEffect } from "react";
import { AuthScreen } from "./auth/AuthScreen.js";
import { useAuth } from "./stores/auth.js";
import { ToastStack } from "./components/ui/toast.js";
import { AppShell } from "./shell/AppShell.js";

export function App(): JSX.Element {
  const { session, loading, restore } = useAuth();
  useEffect(() => { void restore(); }, [restore]);

  if (loading) {
    return <div className="h-full flex items-center justify-center text-pulse">Pulse Project Planner · loading…</div>;
  }
  if (!session) return (<>
    <AuthScreen />
    <ToastStack />
  </>);
  return (<>
    <AppShell />
    <ToastStack />
  </>);
}
