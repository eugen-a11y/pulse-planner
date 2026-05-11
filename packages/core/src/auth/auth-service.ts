import type { SupabaseClient } from "@supabase/supabase-js";
import { REFRESH_TOKEN_KEY, type TokenStorage } from "./token-storage.js";

export interface PulseSession {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string | null };
  expiresAt: number;
}

function adapt(raw: any): PulseSession {
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    user: { id: raw.user.id, email: raw.user.email ?? null },
    expiresAt: raw.expires_at,
  };
}

export class AuthService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly storage: TokenStorage,
  ) {}

  async signUp(email: string, password: string): Promise<PulseSession> {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error("sign-up succeeded but no session returned (email confirmation may be required)");
    await this.storage.set(REFRESH_TOKEN_KEY, data.session.refresh_token);
    return adapt(data.session);
  }

  async signIn(email: string, password: string): Promise<PulseSession> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error("no session returned");
    await this.storage.set(REFRESH_TOKEN_KEY, data.session.refresh_token);
    return adapt(data.session);
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    await this.storage.clear();
  }

  /** Wipe the on-disk refresh token without ending the in-memory session.
   *  Used by hosts that want to gate persistence behind a "remember me" toggle. */
  async clearStoredCredentials(): Promise<void> {
    await this.storage.clear();
  }

  async restoreSession(): Promise<PulseSession | null> {
    const refresh = await this.storage.get(REFRESH_TOKEN_KEY);
    if (!refresh) return null;
    // Use refreshSession (the canonical API for "I only have a refresh token").
    // setSession with access_token: "" used to silently fail and clear our token,
    // forcing the user to re-enter credentials on every launch.
    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: refresh,
    });
    if (error) {
      // Surface the error so the host can log it. Do NOT clear storage here —
      // an over-broad regex match on the error message used to wipe valid tokens
      // (e.g. transient 4xx mentioning "refresh_token") and force re-login.
      // The user can manually sign out if they want to clear stored credentials.
      const e = new Error(`refreshSession failed: ${error.message}`);
      (e as any).code = (error as any).code ?? "refresh_failed";
      throw e;
    }
    if (!data.session) return null;
    await this.storage.set(REFRESH_TOKEN_KEY, data.session.refresh_token);
    return adapt(data.session);
  }

  onAuthStateChange(cb: (session: PulseSession | null) => void): () => void {
    const { data } = this.supabase.auth.onAuthStateChange((_event, session) => {
      cb(session ? adapt(session) : null);
    });
    return () => data.subscription.unsubscribe();
  }
}
