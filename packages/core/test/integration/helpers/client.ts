import {
  AuthService,
  createPulseSupabaseClient,
  InMemoryStore,
  Outbox,
  SyncEngine,
  type TokenStorage,
} from "../../../src/index.js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-test.js";

class MemoryTokens implements TokenStorage {
  store = new Map<string, string>();
  async get(k: string) { return this.store.get(k) ?? null; }
  async set(k: string, v: string) { this.store.set(k, v); }
  async clear() { this.store.clear(); }
}

export interface TestClient {
  userId: string;
  store: InMemoryStore;
  outbox: Outbox;
  engine: SyncEngine;
  signOut: () => Promise<void>;
}

/** Build a signed-in TestClient. The user must already exist (createTestUser). */
export async function buildSignedInClient(
  email: string, password: string,
): Promise<TestClient> {
  const supa = createPulseSupabaseClient({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
  const auth = new AuthService(supa, new MemoryTokens());
  const session = await auth.signIn(email, password);
  // Inject the access token so PostgREST sees the user.
  await supa.auth.setSession({ access_token: session.accessToken, refresh_token: session.refreshToken });
  const store = new InMemoryStore();
  const outbox = new Outbox();
  const engine = new SyncEngine({ supabase: supa, outbox, store, userId: session.user.id });
  return {
    userId: session.user.id,
    store, outbox, engine,
    signOut: () => auth.signOut(),
  };
}
