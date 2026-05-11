/**
 * Shared SQLite DDL for Pulse local databases.
 *
 * Reflects the **final post-migration schema**:
 * - projects includes due_date TEXT and description TEXT (from migration 20260511000001)
 * - tasks.project_id is nullable TEXT with no NOT NULL (from migration 20260511000002)
 *
 * Consumed by:
 * - apps/desktop: deps.ts for fresh DB init (idempotent CREATE TABLE IF NOT EXISTS)
 * - apps/mobile: ExpoSqliteStore (Phase 3)
 *
 * Note: subtasks are represented as tasks with parent_task_id set; there is no
 * separate subtasks table in this schema.
 */

export const TABLE_DDL: {
  projects: string;
  tasks: string;
  tags: string;
  task_tags: string;
  comments: string;
  notes: string;
  time_entries: string;
  attachments: string;
} = {
  projects: `CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL,
  archived     INTEGER NOT NULL,
  sort_order   INTEGER NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,
  due_date     TEXT,
  description  TEXT
);
CREATE INDEX IF NOT EXISTS projects_user_updated ON projects (user_id, updated_at);`,

  tasks: `CREATE TABLE IF NOT EXISTS tasks (
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
CREATE INDEX IF NOT EXISTS tasks_user_project ON tasks (user_id, project_id);
CREATE INDEX IF NOT EXISTS tasks_user_due     ON tasks (user_id, due_date);
CREATE INDEX IF NOT EXISTS tasks_user_updated ON tasks (user_id, updated_at);`,

  tags: `CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS tags_user_updated ON tags (user_id, updated_at);`,

  task_tags: `CREATE TABLE IF NOT EXISTS task_tags (
  task_id     TEXT NOT NULL,
  tag_id      TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (task_id, tag_id)
);
CREATE INDEX IF NOT EXISTS task_tags_task ON task_tags (task_id);`,

  comments: `CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  task_id     TEXT NOT NULL,
  body_md     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS comments_user_updated ON comments (user_id, updated_at);
CREATE INDEX IF NOT EXISTS comments_task ON comments (task_id);`,

  notes: `CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  project_id  TEXT,
  task_id     TEXT,
  body_md     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS notes_user_updated ON notes (user_id, updated_at);`,

  time_entries: `CREATE TABLE IF NOT EXISTS time_entries (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL,
  task_id            TEXT NOT NULL,
  started_at         TEXT NOT NULL,
  ended_at           TEXT,
  duration_seconds   INTEGER,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  deleted_at         TEXT
);
CREATE INDEX IF NOT EXISTS time_entries_user_updated ON time_entries (user_id, updated_at);
CREATE INDEX IF NOT EXISTS time_entries_user_task ON time_entries (user_id, task_id);`,

  attachments: `CREATE TABLE IF NOT EXISTS attachments (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  task_id       TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  filename      TEXT NOT NULL,
  mime          TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);
CREATE INDEX IF NOT EXISTS attachments_user_updated ON attachments (user_id, updated_at);`,
};

export const SYNC_STATE_DDL: string = `CREATE TABLE IF NOT EXISTS sync_state (
  table_name      TEXT PRIMARY KEY,
  last_pulled_at  TEXT NOT NULL
);`;

/**
 * Full DDL bundle: PRAGMAs first, then tables in dependency order, then sync_state.
 * Run this string via db.exec() to initialise a fresh Pulse SQLite database.
 */
export const ALL_DDL: string = [
  "PRAGMA journal_mode = WAL;",
  "PRAGMA foreign_keys = ON;",
  TABLE_DDL.projects,
  TABLE_DDL.tasks,
  TABLE_DDL.tags,
  TABLE_DDL.task_tags,
  TABLE_DDL.comments,
  TABLE_DDL.notes,
  TABLE_DDL.time_entries,
  TABLE_DDL.attachments,
  SYNC_STATE_DDL,
].join("\n\n");
