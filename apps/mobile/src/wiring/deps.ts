import * as SQLite from "expo-sqlite";
import Constants from "expo-constants";
import {
  AuthService,
  createPulseSupabaseClient,
  Outbox,
  SyncEngine,
  type SupabaseClient,
} from "@pulse/core";
import { openExpoSqliteStore, ExpoSqliteStore } from "@/platform/ExpoSqliteStore";
import { ExpoSqliteSyncStateRepo } from "@/platform/ExpoSqliteSyncStateRepo";
import { SecureStoreTokenStorage } from "@/platform/SecureStoreTokenStorage";

export interface MobileDeps {
  db: SQLite.SQLiteDatabase;
  store: ExpoSqliteStore;
  stateRepo: ExpoSqliteSyncStateRepo;
  outbox: Outbox;
  supabase: SupabaseClient;
  auth: AuthService;
  engine: SyncEngine | null;
  /** Current signed-in user id, or null. Set by setUserId(). */
  userId: string | null;
  setUserId(userId: string): void;
}

export async function buildDeps(): Promise<MobileDeps> {
  // Cloud-Supabase defaults so the app works without env vars (mirrors desktop deps.ts).
  // The anon ("publishable") key is by-design public; safe to embed in shipped builds.
  const url =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.supabaseUrl as string | undefined
    ?? process.env.EXPO_PUBLIC_SUPABASE_URL
    ?? "https://albbdekronmsiqiwnlpp.supabase.co";
  const anonKey =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.supabaseAnonKey as string | undefined
    ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    ?? "sb_publishable_nTaAenxeN3AgjrqUxb3SLw_ERv_wD3u";

  const db = await SQLite.openDatabaseAsync("pulse.db");
  const store = await openExpoSqliteStore(db);
  const stateRepo = new ExpoSqliteSyncStateRepo(db);
  const outbox = new Outbox();
  const supabase = createPulseSupabaseClient({ url, anonKey });
  const auth = new AuthService(supabase, new SecureStoreTokenStorage());

  // After every outbox enqueue, fire a debounced push so mobile mutations
  // reach Supabase within ~200ms instead of waiting for the 60s backstop or
  // the next manual pull. Mirrors desktop's `pushAfterMutation`.
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  const originalEnqueue = outbox.enqueue.bind(outbox);
  outbox.enqueue = async (entry) => {
    const result = await originalEnqueue(entry);
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      const engine = deps.engine;
      if (!engine) return;
      void engine.push().catch(() => {
        // Push errors are surfaced via outbox.lastError → DLQ screen.
      });
    }, 200);
    return result;
  };

  const deps: MobileDeps = {
    db,
    store,
    stateRepo,
    outbox,
    supabase,
    auth,
    engine: null,
    userId: null,
    setUserId(userId: string) {
      deps.userId = userId;
      deps.engine = new SyncEngine({ supabase, outbox, store, userId, stateRepo });
    },
  };
  return deps;
}
