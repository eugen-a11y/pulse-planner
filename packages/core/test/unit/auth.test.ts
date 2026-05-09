import { describe, expect, it, beforeEach } from "vitest";
import { AuthService } from "../../src/auth/auth-service.js";
import type { TokenStorage } from "../../src/auth/token-storage.js";

class InMemoryTokenStorage implements TokenStorage {
  store = new Map<string, string>();
  async get(k: string) { return this.store.get(k) ?? null; }
  async set(k: string, v: string) { this.store.set(k, v); }
  async clear() { this.store.clear(); }
}

const FAKE_SESSION = {
  access_token: "at",
  refresh_token: "rt",
  user: { id: "u1", email: "x@y" },
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

function makeFakeSupabase(behavior: {
  signIn?: any;
  signUp?: any;
  signOut?: any;
  getSession?: any;
  setSession?: any;
}) {
  const cbs: any[] = [];
  return {
    auth: {
      signInWithPassword: async () => behavior.signIn ?? { data: { session: FAKE_SESSION }, error: null },
      signUp: async () => behavior.signUp ?? { data: { session: FAKE_SESSION }, error: null },
      signOut: async () => behavior.signOut ?? { error: null },
      getSession: async () => behavior.getSession ?? { data: { session: FAKE_SESSION }, error: null },
      setSession: async () => behavior.setSession ?? { data: { session: FAKE_SESSION }, error: null },
      onAuthStateChange: (cb: any) => {
        cbs.push(cb);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    _cbs: cbs,
  } as any;
}

describe("AuthService", () => {
  let storage: InMemoryTokenStorage;
  beforeEach(() => { storage = new InMemoryTokenStorage(); });

  it("signIn persists refresh token", async () => {
    const supa = makeFakeSupabase({});
    const auth = new AuthService(supa, storage);
    const session = await auth.signIn("x@y", "pw");
    expect(session.user.id).toBe("u1");
    expect(await storage.get("pulse.refresh_token")).toBe("rt");
  });

  it("signOut clears storage", async () => {
    const supa = makeFakeSupabase({});
    const auth = new AuthService(supa, storage);
    await auth.signIn("x@y", "pw");
    await auth.signOut();
    expect(await storage.get("pulse.refresh_token")).toBeNull();
  });

  it("restoreSession uses stored refresh token", async () => {
    await storage.set("pulse.refresh_token", "rt-stored");
    const supa = makeFakeSupabase({});
    const auth = new AuthService(supa, storage);
    const restored = await auth.restoreSession();
    expect(restored?.user.id).toBe("u1");
  });

  it("restoreSession returns null when no token stored", async () => {
    const supa = makeFakeSupabase({});
    const auth = new AuthService(supa, storage);
    expect(await auth.restoreSession()).toBeNull();
  });

  it("signIn surfaces error", async () => {
    const supa = makeFakeSupabase({ signIn: { data: { session: null }, error: { message: "bad creds" } } });
    const auth = new AuthService(supa, storage);
    await expect(auth.signIn("x@y", "wrong")).rejects.toThrow(/bad creds/);
  });
});
