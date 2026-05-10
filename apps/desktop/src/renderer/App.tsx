import { useEffect } from "react";
import { AuthScreen } from "./auth/AuthScreen.js";
import { useAuth } from "./stores/auth.js";
import { ToastStack } from "./components/ui/toast.js";

export function App(): JSX.Element {
  const { session, loading, restore } = useAuth();
  useEffect(() => { void restore(); }, [restore]);

  if (loading) {
    return <div className="h-full flex items-center justify-center text-pulse">Pulse · loading…</div>;
  }
  if (!session) return (<>
    <AuthScreen />
    <ToastStack />
  </>);
  return (<>
    <div className="h-full flex items-center justify-center text-2xl text-pulse">Signed in as {session.user.email ?? session.user.id}</div>
    <ToastStack />
  </>);
}
