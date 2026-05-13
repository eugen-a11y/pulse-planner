import { useEffect, useState } from "react";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { useAuth } from "../stores/auth.js";
import { useToasts } from "../components/ui/toast.js";
import { api } from "../api.js";
import logoUrl from "../../../assets/electron-default.png";

type Mode = "signin" | "signup" | "forgot";

export function AuthScreen(): JSX.Element {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { signIn, signUp } = useAuth();
  const push = useToasts((s) => s.push);

  useEffect(() => {
    void api.prefs.get().then((p) => setRememberMe(Boolean(p?.rememberMe)));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email, pw, rememberMe);
      } else if (mode === "signup") {
        await signUp(email, pw, rememberMe);
      } else {
        await api.auth.resetPasswordForEmail(email.trim());
        setResetSent(true);
      }
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signin" ? "Anmelden" : mode === "signup" ? "Konto erstellen" : "Passwort vergessen";

  return (
    <div className="h-full flex items-center justify-center bg-[var(--gray-bg)]">
      <form onSubmit={submit} className="w-[360px] bg-white rounded-lg shadow-md border border-[var(--border)] p-8 space-y-4">
        <div className="text-center">
          <img src={logoUrl} alt="Pulse Project Planner" className="w-16 h-16 mx-auto mb-3" />
          <div className="text-2xl font-semibold text-pulse mb-1 leading-tight">Pulse Project Planner</div>
          <div className="text-sm text-gray-500">{title}</div>
        </div>

        {mode === "forgot" && resetSent ? (
          <>
            <div className="text-sm bg-green-50 border border-green-200 text-green-800 rounded-md p-3">
              E-Mail gesendet an <span className="font-medium">{email.trim()}</span>. Öffne den Link im Browser,
              vergib ein neues Passwort und melde dich danach hier neu an.
            </div>
            <Button type="button" className="w-full" onClick={() => { setMode("signin"); setResetSent(false); setPw(""); }}>
              Zurück zur Anmeldung
            </Button>
          </>
        ) : (
          <>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@beispiel.de" />
            {mode !== "forgot" && (
              <Input type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Passwort" />
            )}
            {mode !== "forgot" && (
              <label className="flex items-center gap-2 text-sm text-gray-600 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 accent-pulse"
                />
                Angemeldet bleiben
              </label>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "..." : mode === "signin" ? "Anmelden" : mode === "signup" ? "Konto erstellen" : "Reset-Link senden"}
            </Button>
            {mode === "signin" && (
              <div className="text-xs text-center">
                <button type="button" className="text-pulse underline" onClick={() => setMode("forgot")}>
                  Passwort vergessen?
                </button>
              </div>
            )}
            <div className="text-xs text-center text-gray-500">
              {mode === "signin" && <>Neu hier? <button type="button" className="text-pulse underline" onClick={() => setMode("signup")}>Konto erstellen</button></>}
              {mode === "signup" && <>Schon dabei? <button type="button" className="text-pulse underline" onClick={() => setMode("signin")}>Anmelden</button></>}
              {mode === "forgot" && <button type="button" className="text-pulse underline" onClick={() => setMode("signin")}>Abbrechen</button>}
            </div>
          </>
        )}
      </form>
    </div>
  );
}
