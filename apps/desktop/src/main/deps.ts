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

// Idempotent additive schema changes that mirror Postgres migrations on cloud.
// SQLite has no `ADD COLUMN IF NOT EXISTS` and no `ALTER COLUMN`, so we
// PRAGMA-check first and either ADD COLUMN or rebuild a table as needed.
function applyAdditiveMigrations(db: Database.Database): void {
  // 20260511000001 — projects.due_date / description
  const projectCols = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
  const projHas = (col: string) => projectCols.some((c) => c.name === col);
  if (!projHas("due_date"))    db.exec("ALTER TABLE projects ADD COLUMN due_date TEXT");
  if (!projHas("description")) db.exec("ALTER TABLE projects ADD COLUMN description TEXT");

  // 20260511000002 — tasks.project_id NOT NULL → nullable (Inbox).
  // SQLite can only drop NOT NULL via table rebuild.
  const taskCols = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string; notnull: number }>;
  const projectIdCol = taskCols.find((c) => c.name === "project_id");
  if (projectIdCol && projectIdCol.notnull === 1) {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN TRANSACTION;
      CREATE TABLE tasks_new (
        id                    TEXT PRIMARY KEY,
        user_id               TEXT NOT NULL,
        project_id            TEXT,
        parent_task_id        TEXT,
        title                 TEXT NOT NULL,
        description           TEXT,
        status                TEXT NOT NULL,
        priority              INTEGER NOT NULL,
        due_date              TEXT,
        completed_at          TEXT,
        sort_order            INTEGER NOT NULL,
        recurrence_rule       TEXT,
        recurrence_parent_id  TEXT,
        created_at            TEXT NOT NULL,
        updated_at            TEXT NOT NULL,
        deleted_at            TEXT
      );
      INSERT INTO tasks_new SELECT * FROM tasks;
      DROP TABLE tasks;
      ALTER TABLE tasks_new RENAME TO tasks;
      CREATE INDEX IF NOT EXISTS tasks_user_project ON tasks (user_id, project_id);
      CREATE INDEX IF NOT EXISTS tasks_user_due     ON tasks (user_id, due_date);
      CREATE INDEX IF NOT EXISTS tasks_user_updated ON tasks (user_id, updated_at);
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
  }
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
  // Cloud-Supabase defaults so the installer is self-contained — no .env required.
  // The anon ("publishable") key is by-design public; safe to embed in shipped builds.
  // A local repo .env overrides these for dev work; userData/.env still wins after.
  const url = process.env.SUPABASE_URL ?? "https://albbdekronmsiqiwnlpp.supabase.co";
  const anonKey = process.env.SUPABASE_ANON_KEY ?? "sb_publishable_nTaAenxeN3AgjrqUxb3SLw_ERv_wD3u";
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
