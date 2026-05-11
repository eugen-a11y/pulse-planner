import { useEffect, useState } from "react";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { useAuth } from "../stores/auth.js";
import { useToasts } from "../components/ui/toast.js";
import { api } from "../api.js";
import logoUrl from "../../../assets/electron-default.png";

export function AuthScreen(): JSX.Element {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { signIn, signUp } = useAuth();
  const push = useToasts((s) => s.push);

  // Initialise the checkbox from the saved preference (default: false on first launch).
  useEffect(() => {
    void api.prefs.get().then((p) => setRememberMe(Boolean(p?.rememberMe)));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") await signIn(email, pw, rememberMe);
      else                   await signUp(email, pw, rememberMe);
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center bg-[var(--gray-bg)]">
      <form onSubmit={submit} className="w-[360px] bg-white rounded-lg shadow-md border border-[var(--border)] p-8 space-y-4">
        <div className="text-center">
          <img src={logoUrl} alt="Pulse Project Planner" className="w-16 h-16 mx-auto mb-3" />
          <div className="text-2xl font-semibold text-pulse mb-1 leading-tight">Pulse Project Planner</div>
          <div className="text-sm text-gray-500">{mode === "signin" ? "Anmelden" : "Konto erstellen"}</div>
        </div>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@beispiel.de" />
        <Input type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Passwort" />
        <label className="flex items-center gap-2 text-sm text-gray-600 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 accent-pulse"
          />
          Angemeldet bleiben
        </label>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "..." : mode === "signin" ? "Anmelden" : "Konto erstellen"}
        </Button>
        <div className="text-xs text-center text-gray-500">
          {mode === "signin" ? "Neu hier? " : "Schon dabei? "}
          <button type="button" className="text-pulse underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "Konto erstellen" : "Anmelden"}
          </button>
        </div>
      </form>
    </div>
  );
}
