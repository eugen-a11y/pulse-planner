import { create } from "zustand";
import type { PulseSession } from "@pulse/core";
import type { MobileDeps } from "@/wiring/deps";
import { getRememberMe, setRememberMe } from "@/lib/prefs";

/**
 * Mobile auth store. Mirrors `apps/desktop/src/renderer/stores/auth.ts` action
 * surface but talks directly to `@pulse/core`'s AuthService through `deps`
 * (no IPC). `rememberMe` is wired through MMKV (mobile's prefs store) to mirror
 * desktop's electron-store-backed prefs.
 */
let _deps: MobileDeps | null = null;
export function bindDeps(d: MobileDeps): void { _deps = d; }
function deps(): MobileDeps {
  if (!_deps) throw new Error("auth store: bindDeps() not called");
  return _deps;
}

interface AuthState {
  session: PulseSession | null;
  loading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signUp: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  restore: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  loading: true,
  async signIn(email, password, rememberMe = false) {
    const d = deps();
    const session = await d.auth.signIn(email, password);
    if (!rememberMe) await d.auth.clearStoredCredentials();
    setRememberMe(rememberMe);
    d.setUserId(session.user.id);
    set({ session, loading: false });
  },
  async signUp(email, password, rememberMe = false) {
    const d = deps();
    const session = await d.auth.signUp(email, password);
    if (!rememberMe) await d.auth.clearStoredCredentials();
    setRememberMe(rememberMe);
    d.setUserId(session.user.id);
    set({ session, loading: false });
  },
  async signOut() {
    const d = deps();
    await d.auth.signOut();
    d.engine = null;
    d.userId = null;
    set({ session: null });
  },
  async restore() {
    const d = deps();
    if (!getRememberMe()) {
      set({ session: null, loading: false });
      return;
    }
    try {
      const session = await d.auth.restoreSession();
      if (session) d.setUserId(session.user.id);
      set({ session, loading: false });
    } catch {
      set({ session: null, loading: false });
    }
  },
}));
