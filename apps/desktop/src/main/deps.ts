import Database from "better-sqlite3";
import { app } from "electron";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AuthService,
  createPulseSupabaseClient,
  Outbox,
  SyncEngine,
} from "@pulse/core";
import { BetterSqliteStore } from "./store/better-sqlite-store.js";
import { SqliteSyncStateRepo } from "./store/sqlite-sync-state-repo.js";
import { FileTokenStorage } from "./file-token-storage.js";

export interface AppDeps {
  db: Database.Database;
  store: BetterSqliteStore;
  stateRepo: SqliteSyncStateRepo;
  outbox: Outbox;
  supabase: ReturnType<typeof createPulseSupabaseClient>;
  auth: AuthService;
  engine: SyncEngine | null;     // becomes non-null after sign-in (userId injected)
  setUserId(userId: string): void;
}

export function buildDeps(): AppDeps {
  const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  const anonKey = process.env.SUPABASE_ANON_KEY ?? "";
  const dbPath = join(app.getPath("userData"), "pulse.db");
  const db = new Database(dbPath);
  const migration = readFileSync(
    join(import.meta.dirname ?? __dirname, "store", "migrations", "001_init.sql"),
    "utf8",
  );
  db.exec(migration);

  const store = new BetterSqliteStore(db);
  const stateRepo = new SqliteSyncStateRepo(db);
  const outbox = new Outbox();
  const supabase = createPulseSupabaseClient({ url, anonKey });
  const auth = new AuthService(supabase, new FileTokenStorage());

  const deps: AppDeps = {
    db, store, stateRepo, outbox, supabase, auth,
    engine: null,
    setUserId(userId) {
      deps.engine = new SyncEngine({ supabase, outbox, store, userId, stateRepo });
    },
  };
  return deps;
}
