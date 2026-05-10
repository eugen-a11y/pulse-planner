-- Pulse local SQLite schema (Phase 2 desktop). Mirrors Supabase shapes.
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL,
  archived     INTEGER NOT NULL,
  sort_order   INTEGER NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);
CREATE INDEX IF NOT EXISTS projects_user_updated ON projects (user_id, updated_at);

CREATE TABLE IF NOT EXISTS tasks (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL,
  project_id            TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS tasks_user_due ON tasks (user_id, due_date);
CREATE INDEX IF NOT EXISTS tasks_user_updated ON tasks (user_id, updated_at);

CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS tags_user_updated ON tags (user_id, updated_at);

CREATE TABLE IF NOT EXISTS task_tags (
  task_id     TEXT NOT NULL,
  tag_id      TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (task_id, tag_id)
);
CREATE INDEX IF NOT EXISTS task_tags_task ON task_tags (task_id);

CREATE TABLE IF NOT EXISTS attachments (
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
CREATE INDEX IF NOT EXISTS attachments_user_updated ON attachments (user_id, updated_at);

CREATE TABLE IF NOT EXISTS time_entries (
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
CREATE INDEX IF NOT EXISTS time_entries_user_task ON time_entries (user_id, task_id);

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  task_id     TEXT NOT NULL,
  body_md     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS comments_user_updated ON comments (user_id, updated_at);
CREATE INDEX IF NOT EXISTS comments_task ON comments (task_id);

CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  project_id  TEXT,
  task_id     TEXT,
  body_md     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS notes_user_updated ON notes (user_id, updated_at);

CREATE TABLE IF NOT EXISTS sync_state (
  table_name      TEXT PRIMARY KEY,
  last_pulled_at  TEXT NOT NULL
);
