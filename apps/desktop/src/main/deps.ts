import Database from "better-sqlite3";
import { app } from "electron";
import { join } from "node:path";
import WebSocket from "ws";
import {
  AuthService,
  createPulseSupabaseClient,
  Outbox,
  SyncEngine,
} from "@pulse/core";
import { BetterSqliteStore } from "./store/better-sqlite-store.js";
import { SqliteSyncStateRepo } from "./store/sqlite-sync-state-repo.js";
import { FileTokenStorage } from "./file-token-storage.js";
import { TimerService } from "./timer.js";
// Vite ?raw imports inline the file contents at build time, so the SQL ships
// inside the JS bundle — no runtime fs read, works equally in dev and packaged ASAR.
import migrationSql from "./store/migrations/001_init.sql?raw";

// Idempotent column-additions that mirror Postgres migrations on the cloud side.
// SQLite has no `ADD COLUMN IF NOT EXISTS`, so we PRAGMA-check before issuing each ALTER.
function applyAdditiveMigrations(db: Database.Database): void {
  const projectCols = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
  const has = (col: string) => projectCols.some((c) => c.name === col);
  if (!has("due_date"))    db.exec("ALTER TABLE projects ADD COLUMN due_date TEXT");
  if (!has("description")) db.exec("ALTER TABLE projects ADD COLUMN description TEXT");
}

export interface AppDeps {
  db: Database.Database;
  store: BetterSqliteStore;
  stateRepo: SqliteSyncStateRepo;
  outbox: Outbox;
  supabase: ReturnType<typeof createPulseSupabaseClient>;
  auth: AuthService;
  engine: SyncEngine | null;     // becomes non-null after sign-in (userId injected)
  timer: TimerService | null;
  setUserId(userId: string): void;
}

export function buildDeps(): AppDeps {
  const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  const anonKey = process.env.SUPABASE_ANON_KEY ?? "";
  const dbPath = join(app.getPath("userData"), "pulse.db");
  const db = new Database(dbPath);
  db.exec(migrationSql);
  applyAdditiveMigrations(db);

  const store = new BetterSqliteStore(db);
  const stateRepo = new SqliteSyncStateRepo(db);
  const outbox = new Outbox();
  // Electron 33 ships Node 20 without a global WebSocket; inject `ws` for the
  // Supabase Realtime client so subscriptions work in the main process.
  const supabase = createPulseSupabaseClient({
    url,
    anonKey,
    options: { realtime: { transport: WebSocket as unknown as never, params: { eventsPerSecond: 5 } } },
  });
  const auth = new AuthService(supabase, new FileTokenStorage());

  const deps: AppDeps = {
    db, store, stateRepo, outbox, supabase, auth,
    engine: null,
    timer: null,
    setUserId(userId) {
      deps.engine = new SyncEngine({ supabase, outbox, store, userId, stateRepo });
      deps.timer = new TimerService({ store, outbox, userId });
      void deps.timer.init();
    },
  };
  return deps;
}
