import { useEffect, useState } from "react";
import { Dialog, DialogTitle } from "./ui/dialog.js";
import { Button } from "./ui/button.js";
import { Input } from "./ui/input.js";
import { useAuth } from "../stores/auth.js";
import { api } from "../api.js";

export function ReSignInModal(): JSX.Element | null {
  const [needed, setNeeded] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const session = useAuth((s) => s.session);
  const signIn = useAuth((s) => s.signIn);

  useEffect(() => {
    const off = api.events.on("auth.expired", () => setNeeded(true));
    return off;
  }, []);

  if (!needed || !session) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // Honour the user's existing rememberMe preference on re-auth, so a
      // mid-session token expiry doesn't silently flip them off auto-login.
      const prefs = await api.prefs.get();
      await signIn(email || session!.user.email!, pw, Boolean(prefs?.rememberMe));
      setNeeded(false);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={needed} onOpenChange={() => {}}>
      <DialogTitle className="text-lg font-semibold mb-2">Sitzung abgelaufen</DialogTitle>
      <p className="text-sm text-gray-600 mb-3">Bitte erneut anmelden — deine Outbox bleibt erhalten.</p>
      <form onSubmit={submit} className="space-y-2">
        <Input type="email" placeholder={session.user.email ?? "email"} value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" required placeholder="Passwort" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button type="submit" disabled={busy} className="w-full">{busy ? "..." : "Anmelden"}</Button>
      </form>
    </Dialog>
  );
}
